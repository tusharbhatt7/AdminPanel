/**
 * sendInvite — callable Cloud Function (Gen 2)
 *
 * Creates a panel user and sends ONE designed invitation email containing the
 * real password-setup link. That link can only be minted by the Admin SDK,
 * which is why this cannot live in the browser.
 *
 * Deploy this from the repository that already holds the FirstCabs functions.
 * See README.md — deploying from the admin-panel repo would delete the nine
 * functions that are already live.
 *
 * Runtime: Node 20, region asia-south1, to match the existing deployment.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

const { renderInviteEmail } = require('./inviteEmail.cjs');

// Secret, not an env var: set with
//   firebase functions:secrets:set EMAIL_API_KEY
const EMAIL_API_KEY = defineSecret('EMAIL_API_KEY');

// Non-secret configuration.
const EMAIL_FROM = defineString('EMAIL_FROM', { default: 'FirstCabs Admin <no-reply@firstcabs.com>' });
const EMAIL_PROVIDER = defineString('EMAIL_PROVIDER', { default: 'resend' });
const APP_URL = defineString('APP_URL', { default: 'https://fc-admin-panel.vercel.app' });

if (!admin.apps.length) admin.initializeApp();

const ROLES = ['superadmin', 'admin', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Both providers are plain HTTPS, so this adds no npm dependencies. */
const sendEmail = async ({ to, subject, html, text, apiKey, from, provider }) => {
    if (provider === 'sendgrid') {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: from.replace(/.*<|>.*/g, '') || from, name: 'FirstCabs Admin' },
                subject,
                content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
            }),
        });
        if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
    }

    // Default: Resend
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

const writeAudit = (db, entry) => db.collection('audit_logs').add({
    userAgent: 'cloud-function:sendInvite',
    at: admin.firestore.FieldValue.serverTimestamp(),
    ...entry,
});

exports.sendInvite = onCall(
    { region: 'asia-south1', secrets: [EMAIL_API_KEY], cors: true, memory: '256MiB' },
    async (request) => {
        const db = admin.firestore();

        // ── Who is asking ────────────────────────────────────────────────────
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

        const callerSnap = await db.collection('admin_users').doc(request.auth.uid).get();
        const caller = callerSnap.exists ? callerSnap.data() : null;

        if (!caller || caller.isActive === false || !['admin', 'superadmin'].includes(caller.role)) {
            await writeAudit(db, {
                actorUid: request.auth.uid,
                actorEmail: request.auth.token.email || null,
                actorRole: caller?.role ?? null,
                action: 'user.created', targetType: 'user', targetId: null,
                targetLabel: String(request.data?.email || '').toLowerCase(),
                status: 'failure', metadata: { reason: 'caller_not_authorised' },
            });
            throw new HttpsError('permission-denied', 'You cannot add users.');
        }

        // ── Validate what was asked for ──────────────────────────────────────
        const email = String(request.data?.email || '').trim().toLowerCase();
        const name = String(request.data?.name || '').trim();
        const role = String(request.data?.role || '');

        if (!EMAIL_RE.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
        if (!ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Unknown role.');
        if (role === 'superadmin' && caller.role !== 'superadmin') {
            throw new HttpsError('permission-denied', 'Only a superuser can create a superuser.');
        }

        // ── Create the account ───────────────────────────────────────────────
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                emailVerified: false,
                displayName: name || undefined,
            });
        } catch (error) {
            await writeAudit(db, {
                actorUid: request.auth.uid, actorEmail: caller.email, actorRole: caller.role,
                action: 'user.created', targetType: 'user', targetId: null, targetLabel: email,
                status: 'failure', metadata: { reason: error.code || 'create_failed' },
            });
            if (error.code === 'auth/email-already-exists') {
                throw new HttpsError('already-exists', 'An account already exists for that email.');
            }
            throw new HttpsError('internal', 'Could not create the account.');
        }

        // ── The link the browser could never produce ─────────────────────────
        const link = await admin.auth().generatePasswordResetLink(email, {
            url: `${APP_URL.value()}/login`,
            handleCodeInApp: false,
        });

        const { subject, html, text } = renderInviteEmail({
            inviteeEmail: email,
            inviteeName: name,
            inviterName: caller.name || caller.email,
            inviterEmail: caller.email,
            role,
            appUrl: APP_URL.value(),
            setPasswordUrl: link,          // template uses this when present
        });

        try {
            await sendEmail({
                to: email, subject, html, text,
                apiKey: EMAIL_API_KEY.value(),
                from: EMAIL_FROM.value(),
                provider: EMAIL_PROVIDER.value(),
            });
        } catch (error) {
            // The account exists but the invitation did not arrive. Roll the
            // account back so the admin can simply try again, rather than
            // leaving an orphan that blocks the address.
            await admin.auth().deleteUser(userRecord.uid).catch(() => {});
            await writeAudit(db, {
                actorUid: request.auth.uid, actorEmail: caller.email, actorRole: caller.role,
                action: 'user.created', targetType: 'user', targetId: userRecord.uid, targetLabel: email,
                status: 'failure', metadata: { reason: 'email_send_failed', detail: String(error.message).slice(0, 180) },
            });
            throw new HttpsError('internal', 'Account not created — the invitation email could not be sent.');
        }

        // ── Role record ──────────────────────────────────────────────────────
        await db.collection('admin_users').doc(userRecord.uid).set({
            email,
            name: name || email.split('@')[0],
            role,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            createdByEmail: caller.email,
            lastLoginAt: null,
        });

        // Written server-side, so this entry cannot be skipped by a client.
        await writeAudit(db, {
            actorUid: request.auth.uid, actorEmail: caller.email, actorRole: caller.role,
            action: 'user.created', targetType: 'user', targetId: userRecord.uid, targetLabel: email,
            status: 'success', metadata: { role, invitedVia: 'sendInvite', provider: EMAIL_PROVIDER.value() },
        });

        return { uid: userRecord.uid, email, role };
    },
);
