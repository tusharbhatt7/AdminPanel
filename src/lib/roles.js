/**
 * Role and permission model.
 *
 * Roles live in Firestore at admin_users/{uid} and are enforced by security
 * rules, not by this file. Everything here is for *rendering* — hiding a button
 * a user cannot use. A determined user can bypass all of it with devtools, which
 * is why every permission below has a matching rule in firestore.rules.
 *
 * Custom auth claims would be the usual home for roles, but setting them needs
 * the Admin SDK in a Cloud Function; this project's functions live in a separate
 * codebase, so the role document is the source of truth instead.
 */

export const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    VIEWER: 'viewer',
};

export const ROLE_LABELS = {
    [ROLES.SUPERADMIN]: 'Superuser',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.VIEWER]: 'Regular user',
};

export const ROLE_DESCRIPTIONS = {
    [ROLES.SUPERADMIN]: 'Full access, including managing other superusers and deleting accounts.',
    [ROLES.ADMIN]: 'Full operational access and can manage regular users. Cannot alter superusers.',
    [ROLES.VIEWER]: 'Can view and work with rides, drivers and customers. No user or audit access.',
};

export const PERMISSIONS = {
    // operations
    RIDES_READ: 'rides.read',
    DRIVERS_READ: 'drivers.read',
    DRIVERS_WRITE: 'drivers.write',
    CUSTOMERS_READ: 'customers.read',
    CUSTOMERS_WRITE: 'customers.write',
    PAYMENTS_READ: 'payments.read',
    REVIEWS_READ: 'reviews.read',
    ADS_READ: 'ads.read',
    ADS_WRITE: 'ads.write',
    // administration
    USERS_READ: 'users.read',
    USERS_WRITE: 'users.write',
    ROLES_WRITE: 'roles.write',
    AUDIT_READ: 'audit.read',
};

const P = PERMISSIONS;

const OPERATIONAL_READ = [
    P.RIDES_READ, P.DRIVERS_READ, P.CUSTOMERS_READ,
    P.PAYMENTS_READ, P.REVIEWS_READ, P.ADS_READ,
];

const OPERATIONAL_WRITE = [P.DRIVERS_WRITE, P.CUSTOMERS_WRITE, P.ADS_WRITE];

export const ROLE_PERMISSIONS = {
    [ROLES.SUPERADMIN]: [
        ...OPERATIONAL_READ, ...OPERATIONAL_WRITE,
        P.USERS_READ, P.USERS_WRITE, P.ROLES_WRITE, P.AUDIT_READ,
    ],
    [ROLES.ADMIN]: [
        ...OPERATIONAL_READ, ...OPERATIONAL_WRITE,
        P.USERS_READ, P.USERS_WRITE, P.AUDIT_READ,
    ],
    // A regular user works the panel but cannot see or touch administration.
    [ROLES.VIEWER]: [...OPERATIONAL_READ],
};

export const permissionsFor = (role) => ROLE_PERMISSIONS[role] ?? [];

export const can = (role, permission) => permissionsFor(role).includes(permission);

export const isSuperadmin = (role) => role === ROLES.SUPERADMIN;

/**
 * Who may act on whom. An admin must never be able to edit, demote or
 * deactivate a superuser, and nobody may change their own role — that is the
 * privilege-escalation path this whole model exists to close.
 */
export const canManageUser = (actorRole, actorUid, targetUser) => {
    if (!targetUser) return false;
    if (actorUid === targetUser.uid) return false;                 // never yourself
    if (!can(actorRole, PERMISSIONS.USERS_WRITE)) return false;
    if (targetUser.role === ROLES.SUPERADMIN && actorRole !== ROLES.SUPERADMIN) return false;
    return true;
};

/** Roles the actor is allowed to assign. Only a superuser can mint a superuser. */
export const assignableRoles = (actorRole) =>
    actorRole === ROLES.SUPERADMIN
        ? [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.VIEWER]
        : actorRole === ROLES.ADMIN
            ? [ROLES.ADMIN, ROLES.VIEWER]
            : [];
