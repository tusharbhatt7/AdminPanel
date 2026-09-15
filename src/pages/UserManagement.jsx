import React, { useState, useEffect, useCallback } from 'react';
import {
    UserPlus, Search, ShieldCheck, Shield, Eye, MoreHorizontal,
    KeyRound, UserX, UserCheck, Trash2, X, Loader2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/useAuth';
import {
    fetchUsers, createUser, setUserActive, changeUserRole,
    removeUserAccess, sendUserPasswordReset,
} from '../services/adminUserService';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, canManageUser, assignableRoles } from '../lib/roles';
import { formatDateTime } from '../lib/rideStatus';

const ROLE_STYLE = {
    [ROLES.SUPERADMIN]: { pill: 'pill pill-brand', icon: ShieldCheck },
    [ROLES.ADMIN]: { pill: 'pill pill-info', icon: Shield },
    [ROLES.VIEWER]: { pill: 'pill pill-neutral', icon: Eye },
};

export default function UserManagement() {
    const { actor, role: myRole, user: me } = useAuth();
    const [users, setUsers] = useState(null);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(null);
    const [showInvite, setShowInvite] = useState(false);
    const [menuFor, setMenuFor] = useState(null);

    const [form, setForm] = useState({ email: '', name: '', role: ROLES.VIEWER });
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            setUsers(await fetchUsers());
        } catch (error) {
            console.error(error);
            toast.error('Could not load users');
            setUsers([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const act = async (label, fn) => {
        setBusy(label);
        try {
            await fn();
            await load();
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Action failed');
        } finally {
            setBusy(null);
            setMenuFor(null);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const created = await createUser(form, actor);
            toast.success(`Invited ${created.email} — they will set their own password by email`);
            setShowInvite(false);
            setForm({ email: '', name: '', role: ROLES.VIEWER });
            await load();
        } catch (error) {
            toast.error(error.message || 'Could not create the user');
        } finally {
            setCreating(false);
        }
    };

    const q = search.trim().toLowerCase();
    const rows = (users ?? []).filter((u) =>
        !q || [u.email, u.name, u.role].some((f) => f && String(f).toLowerCase().includes(q)));

    const loading = users === null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[20px] font-bold tracking-tight text-fg">Users &amp; Roles</h1>
                    <p className="mt-0.5 text-[13px] text-fg-2">
                        Who can sign in to this panel, and what each of them may do.
                    </p>
                </div>
                <button onClick={() => setShowInvite(true)} className="btn btn-primary">
                    <UserPlus className="w-4 h-4" /> Add user
                </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email or role…" className="field pl-8"
                    />
                </div>
                <p className="text-[13px] text-fg-3">
                    <span className="font-semibold text-fg tabular">{rows.length}</span> user{rows.length === 1 ? '' : 's'}
                </p>
            </div>

            <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
                <div className="overflow-x-auto">
                    <table className="tbl">
                        <thead>
                            <tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Added</th><th /></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i}><td colSpan={6}><div className="h-6 skeleton" /></td></tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} className="py-12 text-center text-[13px] text-fg-3">No users match.</td></tr>
                            ) : rows.map((u) => {
                                const style = ROLE_STYLE[u.role] || ROLE_STYLE[ROLES.VIEWER];
                                const RoleIcon = style.icon;
                                const manageable = canManageUser(myRole, me?.uid, u);
                                const isMe = u.uid === me?.uid;
                                return (
                                    <tr key={u.uid}>
                                        <td>
                                            <div className="font-medium text-fg">
                                                {u.name || u.email?.split('@')[0]}
                                                {isMe && <span className="ml-2 pill pill-neutral">you</span>}
                                            </div>
                                            <div className="font-mono text-[11px] text-fg-3">{u.email}</div>
                                        </td>
                                        <td>
                                            <span className={style.pill}><RoleIcon className="w-3 h-3" /> {ROLE_LABELS[u.role] || u.role}</span>
                                        </td>
                                        <td>
                                            <span className={`pill ${u.isActive === false ? 'pill-danger' : 'pill-ok'}`}>
                                                {u.isActive === false ? 'deactivated' : 'active'}
                                            </span>
                                        </td>
                                        <td className="text-[12px] whitespace-nowrap text-fg-2">
                                            {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-fg-3">never</span>}
                                        </td>
                                        <td className="text-[12px] whitespace-nowrap text-fg-3">
                                            {u.createdAt ? formatDateTime(u.createdAt) : '—'}
                                        </td>
                                        <td className="relative text-right">
                                            <button
                                                onClick={() => setMenuFor(menuFor === u.uid ? null : u.uid)}
                                                disabled={!manageable}
                                                aria-label={manageable ? `Actions for ${u.email}` : 'No actions available'}
                                                title={manageable ? undefined : isMe ? 'You cannot change your own access' : 'Your role cannot manage this user'}
                                                className="p-1.5 rounded-md text-fg-3 hover:bg-raised hover:text-fg disabled:opacity-30 disabled:pointer-events-none"
                                            >
                                                {busy === u.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                                            </button>

                                            {menuFor === u.uid && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setMenuFor(null)} />
                                                    <div className="absolute right-0 z-40 w-56 mt-1 overflow-hidden text-left border rounded-lg bg-surface border-line shadow-2xl">
                                                        {assignableRoles(myRole).filter((r) => r !== u.role).map((r) => (
                                                            <button
                                                                key={r}
                                                                onClick={() => act(u.uid, async () => {
                                                                    await changeUserRole(u, r, actor);
                                                                    toast.success(`${u.email} is now ${ROLE_LABELS[r]}`);
                                                                })}
                                                                className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-fg-2 hover:bg-raised hover:text-fg"
                                                            >
                                                                <Shield className="w-3.5 h-3.5" /> Make {ROLE_LABELS[r]}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => act(u.uid, async () => {
                                                                await sendUserPasswordReset(u, actor);
                                                                toast.success(`Reset link sent to ${u.email}`);
                                                            })}
                                                            className="flex items-center w-full gap-2 px-3 py-2 text-[13px] border-t text-fg-2 border-line hover:bg-raised hover:text-fg"
                                                        >
                                                            <KeyRound className="w-3.5 h-3.5" /> Send password reset
                                                        </button>
                                                        <button
                                                            onClick={() => act(u.uid, async () => {
                                                                await setUserActive(u, u.isActive === false, actor);
                                                                toast.success(u.isActive === false ? 'User reactivated' : 'User deactivated');
                                                            })}
                                                            className="flex items-center w-full gap-2 px-3 py-2 text-[13px] border-t text-fg-2 border-line hover:bg-raised hover:text-fg"
                                                        >
                                                            {u.isActive === false
                                                                ? <><UserCheck className="w-3.5 h-3.5" /> Reactivate</>
                                                                : <><UserX className="w-3.5 h-3.5" /> Deactivate</>}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!window.confirm(`Remove panel access for ${u.email}? They will not be able to sign in.`)) return;
                                                                act(u.uid, async () => {
                                                                    await removeUserAccess(u, actor);
                                                                    toast.success('Access removed');
                                                                });
                                                            }}
                                                            className="flex items-center w-full gap-2 px-3 py-2 text-[13px] border-t text-danger border-line hover:bg-danger-soft"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> Remove access
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 text-[12px] border rounded-lg bg-surface border-line text-fg-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-fg-3" />
                <span>
                    Removing access deletes the role record, which is what sign-in checks — the account can no longer
                    get in. The dormant Firebase Auth record itself can only be erased from the Firebase console or by a
                    Cloud Function, which a browser is not permitted to do.
                </span>
            </div>

            {/* Invite */}
            {showInvite && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/40 backdrop-blur-sm">
                    <div className="w-full max-w-md p-5 border rounded-xl bg-surface border-line shadow-2xl">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">Add a user</h2>
                                <p className="mt-0.5 text-[12px] text-fg-3">
                                    They receive an email to set their own password. You never see it.
                                </p>
                            </div>
                            <button onClick={() => !creating && setShowInvite(false)} aria-label="Close"
                                className="p-1.5 rounded-md text-fg-3 hover:bg-raised hover:text-fg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="flex flex-col gap-4">
                            <div>
                                <label htmlFor="nu-email" className="field-label">Email</label>
                                <input id="nu-email" type="email" required className="field" value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="person@firstcabs.com" />
                            </div>
                            <div>
                                <label htmlFor="nu-name" className="field-label">Name (optional)</label>
                                <input id="nu-name" type="text" className="field" value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                            </div>
                            <div>
                                <label htmlFor="nu-role" className="field-label">Role</label>
                                <select id="nu-role" className="field" value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                    {assignableRoles(myRole).map((r) => (
                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                </select>
                                <p className="mt-1.5 text-[11px] leading-snug text-fg-3">{ROLE_DESCRIPTIONS[form.role]}</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" disabled={creating} onClick={() => setShowInvite(false)} className="btn btn-default">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating} className="btn btn-primary">
                                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {creating ? 'Creating' : 'Create user'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
