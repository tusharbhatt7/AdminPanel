import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { can as roleCan, permissionsFor } from '../lib/roles';
import { AuthContext } from './authContextObject';

/**
 * Holds the signed-in identity and its role record.
 *
 * The role document is watched rather than read once, so a superuser
 * deactivating an account or changing its role takes effect in that person's
 * open tab immediately — they do not keep their old access until the next
 * reload. Rules enforce the same thing server-side; this is what makes the UI
 * agree with them.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    // With no Firebase config there is nothing to resolve, so seed the flags
    // rather than setting them synchronously inside the effect.
    const [authResolved, setAuthResolved] = useState(() => !auth);
    const [profileResolved, setProfileResolved] = useState(() => !auth);

    useEffect(() => {
        if (!auth) return undefined;
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthResolved(true);
            if (!u) {
                setProfile(null);
                setProfileResolved(true);
            } else {
                setProfileResolved(false);
            }
        });
    }, []);

    useEffect(() => {
        if (!user) return undefined;
        return onSnapshot(
            doc(db, 'admin_users', user.uid),
            (snap) => {
                setProfile(snap.exists() ? { uid: user.uid, ...snap.data() } : null);
                setProfileResolved(true);
            },
            (error) => {
                console.error('Role record unreadable:', error);
                setProfile(null);
                setProfileResolved(true);
            },
        );
    }, [user]);

    const refreshProfile = useCallback(() => setProfileResolved(false), []);

    const value = useMemo(() => {
        const role = profile?.role ?? null;
        const active = !!profile && profile.isActive !== false;
        return {
            user,
            profile,
            role,
            isActive: active,
            // Signed in with Firebase but with no usable role record.
            hasAccess: !!user && active,
            loading: !authResolved || (!!user && !profileResolved),
            permissions: active ? permissionsFor(role) : [],
            can: (permission) => (active ? roleCan(role, permission) : false),
            actor: user ? { uid: user.uid, email: user.email, role } : null,
            refreshProfile,
        };
    }, [user, profile, authResolved, profileResolved, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
