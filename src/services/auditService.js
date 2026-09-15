import {
    collection, addDoc, getDocs, query, where, orderBy, limit,
    startAfter, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Append-only activity log.
 *
 * Rules make audit_logs immutable: create is allowed, update and delete are
 * denied to everyone including superusers, so a record cannot be rewritten or
 * quietly removed after the fact.
 *
 * Known limitation, stated plainly: these entries are written by the client, so
 * rules can constrain their *shape* and pin the actor to the signed-in uid, but
 * cannot force a write to happen. A client that never calls this simply leaves
 * no trace. Closing that needs the same action mirrored in a Cloud Function
 * trigger; the collection shape here is designed so such a trigger can write to
 * it unchanged.
 */

export const AUDIT_ACTIONS = {
    LOGIN: 'auth.login',
    LOGIN_FAILED: 'auth.login_failed',
    LOGOUT: 'auth.logout',
    PASSWORD_RESET_SENT: 'auth.password_reset_sent',
    PASSWORD_CHANGED: 'auth.password_changed',
    USER_CREATED: 'user.created',
    USER_DEACTIVATED: 'user.deactivated',
    USER_REACTIVATED: 'user.reactivated',
    USER_ROLE_CHANGED: 'user.role_changed',
    DRIVER_APPROVAL_CHANGED: 'driver.approval_changed',
    DRIVER_UPDATED: 'driver.updated',
    CUSTOMER_UPDATED: 'customer.updated',
    AD_CREATED: 'ad.created',
    AD_DELETED: 'ad.deleted',
};

export const ACTION_LABELS = {
    [AUDIT_ACTIONS.LOGIN]: 'Signed in',
    [AUDIT_ACTIONS.LOGIN_FAILED]: 'Failed sign-in',
    [AUDIT_ACTIONS.LOGOUT]: 'Signed out',
    [AUDIT_ACTIONS.PASSWORD_RESET_SENT]: 'Password reset sent',
    [AUDIT_ACTIONS.PASSWORD_CHANGED]: 'Password changed',
    [AUDIT_ACTIONS.USER_CREATED]: 'User created',
    [AUDIT_ACTIONS.USER_DEACTIVATED]: 'User deactivated',
    [AUDIT_ACTIONS.USER_REACTIVATED]: 'User reactivated',
    [AUDIT_ACTIONS.USER_ROLE_CHANGED]: 'Role changed',
    [AUDIT_ACTIONS.DRIVER_APPROVAL_CHANGED]: 'Driver approval changed',
    [AUDIT_ACTIONS.DRIVER_UPDATED]: 'Driver updated',
    [AUDIT_ACTIONS.CUSTOMER_UPDATED]: 'Customer updated',
    [AUDIT_ACTIONS.AD_CREATED]: 'Advertisement uploaded',
    [AUDIT_ACTIONS.AD_DELETED]: 'Advertisement deleted',
};

const PAGE_SIZE = 50;

// Anything that could carry a credential is stripped before the record is
// written. Passwords must never reach the log, by accident or otherwise.
const FORBIDDEN_KEYS = /pass|secret|token|credential|apikey|api_key|authorization/i;

const scrub = (metadata = {}) => {
    const clean = {};
    for (const [k, v] of Object.entries(metadata)) {
        if (FORBIDDEN_KEYS.test(k)) {
            clean[k] = '[redacted]';
        } else if (v === undefined) {
            continue;
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            clean[k] = scrub(v);
        } else {
            clean[k] = v;
        }
    }
    return clean;
};

/**
 * Record one action. Never throws: an audit write failing must not roll back or
 * block the operation the user actually asked for — it is reported instead.
 */
export const recordAudit = async ({
    actor, action, targetType = null, targetId = null,
    targetLabel = null, status = 'success', metadata = {},
}) => {
    try {
        await addDoc(collection(db, 'audit_logs'), {
            actorUid: actor?.uid ?? null,
            actorEmail: actor?.email ?? null,
            actorRole: actor?.role ?? null,
            action,
            targetType,
            targetId,
            targetLabel,
            status,
            metadata: scrub(metadata),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : null,
            at: serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error('Audit write failed:', action, error);
        return false;
    }
};

/** Page through the log, newest first, optionally narrowed by action or actor. */
export const fetchAuditLogs = async ({ action = null, actorUid = null, lastDoc = null, pageSize = PAGE_SIZE } = {}) => {
    const constraints = [
        ...(action ? [where('action', '==', action)] : []),
        ...(actorUid ? [where('actorUid', '==', actorUid)] : []),
        orderBy('at', 'desc'),
        ...(lastDoc ? [startAfter(lastDoc)] : []),
        limit(pageSize),
    ];
    const snap = await getDocs(query(collection(db, 'audit_logs'), ...constraints));
    return {
        logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        lastDoc: snap.docs[snap.docs.length - 1] ?? null,
        hasMore: snap.docs.length === pageSize,
    };
};
