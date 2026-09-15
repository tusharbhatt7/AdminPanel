import {
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { recordAudit, AUDIT_ACTIONS } from './auditService';
import { ROLES } from '../lib/roles';

/**
 * Passwords are never handled by this application. Firebase Auth hashes them
 * server-side with scrypt and issues a short-lived ID token plus a refresh
 * token, which the SDK stores and rotates. Nothing here reads, stores or logs a
 * password, and no password is ever placed in an audit record.
 */

// Client-side lockout. Deliberately modest: it improves the experience and
// records the attempt, but it lives in localStorage and is trivially cleared.
// The protection that actually counts is Firebase Auth's own server-side
// throttling, which this cannot replace.
const LOCKOUT_KEY = 'fc-login-attempts';
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000;

const readAttempts = () => {
    try {
        return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}');
    } catch {
        return {};
    }
};

const writeAttempts = (v) => {
    try {
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify(v));
    } catch { /* private mode — lockout simply does not persist */ }
};

export const lockoutState = (email) => {
    const key = (email || '').toLowerCase();
    const rec = readAttempts()[key];
    if (!rec) return { locked: false, remaining: MAX_ATTEMPTS, until: 0 };
    if (rec.until && rec.until > Date.now()) {
        return { locked: true, remaining: 0, until: rec.until };
    }
    return { locked: false, remaining: Math.max(MAX_ATTEMPTS - (rec.count || 0), 0), until: 0 };
};

const noteFailure = (email) => {
    const key = (email || '').toLowerCase();
    const all = readAttempts();
    const rec = all[key] || { count: 0, until: 0 };
    rec.count = (rec.count || 0) + 1;
    if (rec.count >= MAX_ATTEMPTS) rec.until = Date.now() + LOCKOUT_MS;
    all[key] = rec;
    writeAttempts(all);
    return rec;
};

const clearFailures = (email) => {
    const all = readAttempts();
    delete all[(email || '').toLowerCase()];
    writeAttempts(all);
};

export const normaliseEmail = (raw) => String(raw ?? '').trim().toLowerCase();

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/** The signed-in user's role record. Absent means no panel access. */
export const fetchProfile = async (uid) => {
    const snap = await getDoc(doc(db, 'admin_users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
};

export class AuthError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

export const login = async (rawEmail, password) => {
    const email = normaliseEmail(rawEmail);

    if (!isValidEmail(email)) throw new AuthError('invalid-email', 'Enter a valid email address.');
    if (!password) throw new AuthError('missing-password', 'Enter your password.');

    const lock = lockoutState(email);
    if (lock.locked) {
        const mins = Math.ceil((lock.until - Date.now()) / 60000);
        throw new AuthError('locked', `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }

    let credential;
    try {
        credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        const rec = noteFailure(email);
        await recordAudit({
            actor: { uid: null, email, role: null },
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            targetType: 'account',
            targetLabel: email,
            status: 'failure',
            // Deliberately coarse: never echo which half was wrong.
            metadata: { reason: error.code || 'unknown', attempt: rec.count },
        });
        throw new AuthError('invalid-credentials', 'Email or password is incorrect.');
    }

    const profile = await fetchProfile(credential.user.uid);

    // An account with no role record, or a deactivated one, is not allowed in —
    // even though Firebase Auth accepted the password.
    if (!profile || profile.isActive === false) {
        await recordAudit({
            actor: { uid: credential.user.uid, email, role: profile?.role ?? null },
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            targetType: 'account',
            targetId: credential.user.uid,
            targetLabel: email,
            status: 'failure',
            metadata: { reason: profile ? 'account_deactivated' : 'no_role_assigned' },
        });
        await signOut(auth);
        throw new AuthError(
            profile ? 'deactivated' : 'no-access',
            profile
                ? 'This account has been deactivated. Contact a superuser.'
                : 'This account has no panel access. Ask a superuser to add you.',
        );
    }

    clearFailures(email);

    await setDoc(
        doc(db, 'admin_users', credential.user.uid),
        { lastLoginAt: serverTimestamp() },
        { merge: true },
    );

    await recordAudit({
        actor: { uid: credential.user.uid, email, role: profile.role },
        action: AUDIT_ACTIONS.LOGIN,
        targetType: 'account',
        targetId: credential.user.uid,
        targetLabel: email,
    });

    return { user: credential.user, profile };
};

export const logout = async (actor) => {
    await recordAudit({ actor, action: AUDIT_ACTIONS.LOGOUT, targetType: 'account', targetId: actor?.uid });
    await signOut(auth);
};

/** Sends a reset link. Never reveals whether the address is registered. */
export const requestPasswordReset = async (rawEmail, actor = null) => {
    const email = normaliseEmail(rawEmail);
    if (!isValidEmail(email)) throw new AuthError('invalid-email', 'Enter a valid email address.');
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
    }
    await recordAudit({
        actor: actor ?? { uid: null, email, role: null },
        action: AUDIT_ACTIONS.PASSWORD_RESET_SENT,
        targetType: 'account',
        targetLabel: email,
    });
    return true;
};

/** Changing your own password. Firebase requires a recent sign-in, so re-auth first. */
export const changeOwnPassword = async (currentPassword, newPassword, actor) => {
    const user = auth.currentUser;
    if (!user) throw new AuthError('no-session', 'You are not signed in.');
    if (!newPassword || newPassword.length < 8) {
        throw new AuthError('weak-password', 'Use at least 8 characters.');
    }
    try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    } catch {
        await recordAudit({
            actor, action: AUDIT_ACTIONS.PASSWORD_CHANGED, targetType: 'account',
            targetId: user.uid, status: 'failure', metadata: { reason: 'reauth_failed' },
        });
        throw new AuthError('reauth-failed', 'Current password is incorrect.');
    }
    await updatePassword(user, newPassword);
    await recordAudit({ actor, action: AUDIT_ACTIONS.PASSWORD_CHANGED, targetType: 'account', targetId: user.uid });
    return true;
};

export const DEFAULT_ROLE = ROLES.VIEWER;
