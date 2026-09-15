import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, AlertCircle, ShieldCheck, Lock } from 'lucide-react';
import { fetchAuditLogs, AUDIT_ACTIONS, ACTION_LABELS } from '../services/auditService';
import { formatDateTime, formatAge, toDate } from '../lib/rideStatus';

const TONE = (action, status) => {
    if (status === 'failure') return 'pill pill-danger';
    if (action.startsWith('user.') || action === AUDIT_ACTIONS.PASSWORD_CHANGED) return 'pill pill-warn';
    if (action === AUDIT_ACTIONS.LOGIN || action === AUDIT_ACTIONS.LOGOUT) return 'pill pill-info';
    return 'pill pill-neutral';
};

export default function AuditLogs() {
    const [state, setState] = useState({ status: 'loading', logs: [], lastDoc: null, hasMore: false });
    const [actionFilter, setActionFilter] = useState('');
    const [search, setSearch] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const page = await fetchAuditLogs({ action: actionFilter || null }).catch((error) => {
                console.error('Audit read failed:', error);
                return { error };
            });
            if (cancelled) return;
            setState(page.error
                ? { status: 'error', logs: [], lastDoc: null, hasMore: false, error: page.error }
                : { status: 'ok', ...page });
        })();
        return () => { cancelled = true; };
    }, [actionFilter]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const page = await fetchAuditLogs({ action: actionFilter || null, lastDoc: state.lastDoc });
            setState((prev) => ({ ...prev, logs: [...prev.logs, ...page.logs], lastDoc: page.lastDoc, hasMore: page.hasMore }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Free-text narrowing happens over the loaded page; the action dropdown is
    // the indexed filter that goes to Firestore.
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return state.logs;
        return state.logs.filter((l) => [
            l.actorEmail, l.action, l.targetLabel, l.targetId, l.targetType, l.status,
            JSON.stringify(l.metadata || {}),
        ].some((f) => f && String(f).toLowerCase().includes(q)));
    }, [state.logs, search]);

    const needsIndex = state.error?.code === 'failed-precondition';
    const denied = state.error?.code === 'permission-denied';

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-[20px] font-bold tracking-tight text-fg">Audit Log</h1>
                <p className="mt-0.5 text-[13px] text-fg-2">
                    Who did what, and when. Entries cannot be edited or deleted by anyone, including superusers.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col w-full gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search actor, target, details…" className="field pl-8" />
                    </div>
                    <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
                        aria-label="Filter by action" className="field w-auto">
                        <option value="">All actions</option>
                        {Object.values(AUDIT_ACTIONS).map((a) => (
                            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                        ))}
                    </select>
                </div>
                <p className="text-[13px] text-fg-3 whitespace-nowrap">
                    <span className="font-semibold text-fg tabular">{rows.length}</span> shown
                </p>
            </div>

            {state.status === 'error' ? (
                <div className="p-6 text-center border rounded-xl bg-surface border-danger/40">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-danger" />
                    <h3 className="text-sm font-semibold text-fg">
                        {needsIndex ? 'This filter needs a Firestore index'
                            : denied ? 'Your role cannot read the audit log'
                                : 'Could not load the audit log'}
                    </h3>
                    <p className="max-w-md mx-auto mt-2 text-[13px] text-fg-3">
                        {needsIndex
                            ? 'The composite index is still building, which takes a few minutes. Reload once it is ready.'
                            : denied
                                ? 'Only admins and superusers may read audit records.'
                                : state.error?.message}
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
                        <div className="overflow-x-auto">
                            <table className="tbl">
                                <thead>
                                    <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr>
                                </thead>
                                <tbody>
                                    {state.status === 'loading' ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i}><td colSpan={5}><div className="h-5 skeleton" /></td></tr>
                                        ))
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <Lock className="w-5 h-5 mx-auto mb-2 text-fg-3 opacity-50" />
                                                <p className="text-[13px] text-fg-3">
                                                    {search || actionFilter ? 'Nothing matches this filter.' : 'No activity recorded yet.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : rows.map((l) => (
                                        <tr key={l.id}>
                                            <td className="whitespace-nowrap">
                                                <div className="text-[12px] text-fg">{formatDateTime(l.at)}</div>
                                                <div className="font-mono text-[10px] text-fg-3">
                                                    {toDate(l.at) ? formatAge(l.at) : 'pending'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="text-[12px] text-fg">{l.actorEmail || <span className="text-fg-3">anonymous</span>}</div>
                                                {l.actorRole && <div className="font-mono text-[10px] text-fg-3">{l.actorRole}</div>}
                                            </td>
                                            <td className="whitespace-nowrap">
                                                <span className={TONE(l.action, l.status)}>
                                                    {ACTION_LABELS[l.action] || l.action}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="text-[12px] text-fg-2">{l.targetLabel || '—'}</div>
                                                {l.targetType && <div className="font-mono text-[10px] text-fg-3">{l.targetType}</div>}
                                            </td>
                                            <td>
                                                {l.metadata && Object.keys(l.metadata).length > 0 ? (
                                                    <span className="font-mono text-[10px] text-fg-3 break-all line-clamp-2">
                                                        {Object.entries(l.metadata).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('  ')}
                                                    </span>
                                                ) : <span className="text-fg-3">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {state.hasMore && (
                        <div className="flex justify-center">
                            <button onClick={loadMore} disabled={loadingMore} className="btn btn-default">
                                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {loadingMore ? 'Loading' : 'Load older entries'}
                            </button>
                        </div>
                    )}

                    <div className="flex items-start gap-2 px-3 py-2.5 text-[12px] border rounded-lg bg-surface border-line text-fg-2">
                        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-ok" />
                        <span>
                            Security rules allow creates only and deny every update and delete, so this log is
                            append-only. Entries are written by the panel itself, so rules can pin the actor to the
                            signed-in account and reject a forged one, but cannot force a write to happen — mirroring
                            these actions in a Cloud Function trigger would close that last gap.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
