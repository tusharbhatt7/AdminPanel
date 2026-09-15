import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import {
    collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../firebase';
import { recordAudit, AUDIT_ACTIONS } from './auditService';
import { ROLES, canManageUser, assignableRoles } from '../lib/roles';
import { AuthError, normaliseEmail, isValidEmail } from './authService';

/**
 * Panel user administration.
 *
 * Everything here runs against Firestore plus Firebase Auth's client SDK. Two
 * operations would normally want the Admin SDK, and are handled differently:
 *
 *  - Creating a user would sign the acting admin out, because the client SDK
 *    switches the current session on create. A throwaway secondary app instance
 *    is used instead, so the admin's own session is untouched.
 *
 *  - Hard-deleting another account's Auth record is not possible from a client
 *    at all. Removing access therefore deletes the role document, which the
 *    security rules treat as "no access" — the sign-in itself stops working
 *    because login requires an active role record. The dormant Auth record can
 *    be purged from the Firebase console, or by a Cloud Function later.
 */

const USERS = 'admin_users';

/** A password nobody ever sees. The new user sets their own via the reset link. */
const throwawayPassword = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return `Aa1!${btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '')}`;
};

export const fetchUsers = async () => {
    let snap;
    try {
        snap = await getDocs(query(collection(db, USERS), orderBy('createdAt', 'desc')));
    } catch {
        snap = await getDocs(collection(db, USERS));
    }
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};

export const createUser = async ({ email: rawEmail, name, role }, actor) => {
    const email = normaliseEmail(rawEmail);

    if (!isValidEmail(email)) throw new AuthError('invalid-email', 'Enter a valid email address.');
    if (!assignableRoles(actor.role).includes(role)) {
        throw new AuthError('forbidden-role', 'You cannot assign that role.');
    }

    // Secondary app: creating on the primary would replace the admin's session.
    const secondary = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
    let newUid;
    try {
        const secondaryAuth = getAuth(secondary);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, throwawayPassword());
        newUid = cred.user.uid;
        await signOut(secondaryAuth);
    } catch (error) {
        await deleteApp(secondary).catch(() => {});
        await recordAudit({
            actor, action: AUDIT_ACTIONS.USER_CREATED, targetType: 'user', targetLabel: email,
            status: 'failure', metadata: { reason: error.code || 'unknown' },
        });
        if (error.code === 'auth/email-already-in-use') {
            throw new AuthError('email-in-use', 'An account already exists for that email.');
        }
        throw new AuthError('create-failed', 'Could not create the account.');
    }
    await deleteApp(secondary).catch(() => {});

    await setDoc(doc(db, USERS, newUid), {
        email,
        name: (name || '').trim() || email.split('@')[0],
        role,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        lastLoginAt: null,
    });

    // The admin never learns the throwaway password; the new user sets their own.
    await sendPasswordResetEmail(auth, email);

    await recordAudit({
        actor, action: AUDIT_ACTIONS.USER_CREATED, targetType: 'user',
        targetId: newUid, targetLabel: email, metadata: { role, inviteEmailSent: true },
    });

    return { uid: newUid, email, role };
};

export const setUserActive = async (targetUser, isActive, actor) => {
    if (!canManageUser(actor.role, actor.uid, targetUser)) {
        throw new AuthError('forbidden', 'You cannot modify this user.');
    }
    await updateDoc(doc(db, USERS, targetUser.uid), {
        isActive,
        deactivatedAt: isActive ? null : serverTimestamp(),
        deactivatedBy: isActive ? null : actor.uid,
    });
    await recordAudit({
        actor,
        action: isActive ? AUDIT_ACTIONS.USER_REACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
        targetType: 'user', targetId: targetUser.uid, targetLabel: targetUser.email,
        metadata: { role: targetUser.role },
    });
    return true;
};

export const changeUserRole = async (targetUser, nextRole, actor) => {
    if (!canManageUser(actor.role, actor.uid, targetUser)) {
        throw new AuthError('forbidden', 'You cannot modify this user.');
    }
    if (!assignableRoles(actor.role).includes(nextRole)) {
        throw new AuthError('forbidden-role', 'You cannot assign that role.');
    }
    if (targetUser.role === nextRole) return false;

    await updateDoc(doc(db, USERS, targetUser.uid), {
        role: nextRole,
        roleChangedAt: serverTimestamp(),
        roleChangedBy: actor.uid,
    });
    await recordAudit({
        actor, action: AUDIT_ACTIONS.USER_ROLE_CHANGED, targetType: 'user',
        targetId: targetUser.uid, targetLabel: targetUser.email,
        metadata: { from: targetUser.role, to: nextRole },
    });
    return true;
};

/** Removes panel access. Login checks for an active role record, so this revokes it. */
export const removeUserAccess = async (targetUser, actor) => {
    if (!canManageUser(actor.role, actor.uid, targetUser)) {
        throw new AuthError('forbidden', 'You cannot remove this user.');
    }
    await deleteDoc(doc(db, USERS, targetUser.uid));
    await recordAudit({
        actor, action: AUDIT_ACTIONS.USER_DEACTIVATED, targetType: 'user',
        targetId: targetUser.uid, targetLabel: targetUser.email,
        metadata: { removed: true, role: targetUser.role, note: 'role record deleted; auth record remains dormant' },
    });
    return true;
};

/** Sends the user a reset link. An admin never sets another account's password directly. */
export const sendUserPasswordReset = async (targetUser, actor) => {
    if (!canManageUser(actor.role, actor.uid, targetUser) && actor.uid !== targetUser.uid) {
        throw new AuthError('forbidden', 'You cannot reset this user’s password.');
    }
    await sendPasswordResetEmail(auth, targetUser.email);
    await recordAudit({
        actor, action: AUDIT_ACTIONS.PASSWORD_RESET_SENT, targetType: 'user',
        targetId: targetUser.uid, targetLabel: targetUser.email,
    });
    return true;
};

export { ROLES };
