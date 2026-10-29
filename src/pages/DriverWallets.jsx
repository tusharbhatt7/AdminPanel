import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Wallet, Search, X, ArrowDownLeft, ArrowUpRight, AlertTriangle,
    Banknote, ListOrdered, Users, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { PERMISSIONS } from '../lib/roles';
import { fetchDrivers } from '../services/driverService';
import { fetchAllTransactions, fetchCreditsNeedingReview } from '../services/walletService';
import DriverWalletPanel from '../components/DriverWalletPanel';
import WithdrawalsPanel from '../components/WithdrawalsPanel';
import {
    formatRupees, formatPaise, formatSignedPaise, txnTypeLabel, legLabel,
    creditStatusMeta, directionTone,
} from '../lib/wallet';
import { toneText } from '../lib/tones';
import { formatAge, formatDateTime, formatCurrency } from '../lib/rideStatus';

const TABS = [
    { key: 'balances', label: 'Balances', icon: Users },
    { key: 'ledger', label: 'Ledger', icon: ListOrdered },
    { key: 'review', label: 'Needs review', icon: AlertTriangle },
    { key: 'withdrawals', label: 'Withdrawals', icon: Banknote },
];

/**
 * Driver wallets.
 *
 * Read-only by design. The only two actions on this page — approving a payout
 * and adjusting a balance — are Cloud Function callables, because each has to
 * write the ledger row and move the balance in one transaction. Nothing here
 * writes walletBalance or a wallet_transactions document directly; see the note
 * at the top of walletService.js for why that matters.
 */
export default function DriverWallets() {
    const { actor, can } = useAuth();
    const mayMoveMoney = can(PERMISSIONS.WALLETS_WRITE);

    const [params, setParams] = useSearchParams();
    const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'balances';
    const selectedDriver = params.get('driver');

    const [drivers, setDrivers] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetchDrivers()
            .then((list) => { if (!cancelled) setDrivers(list); })
            .catch((error) => { console.error('Drivers failed:', error); if (!cancelled) setDrivers([]); });
        return () => { cancelled = true; };
    }, []);

    const driverNames = useMemo(
        () => Object.fromEntries((drivers ?? []).map((d) => [d.id, d.name || d.phone || d.id])),
        [drivers],
    );

    const setTab = (key) => setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', key);
        next.delete('driver');
        return next;
    }, { replace: true });

    const openDriver = (id) => setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('driver', id);
        return next;
    });

    const closeDriver = () => setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('driver');
        return next;
    });

    const totalBalance = useMemo(
        () => (drivers ?? []).reduce((sum, d) => sum + (typeof d.walletBalance === 'number' ? d.walletBalance : 0), 0),
        [drivers],
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[20px] font-bold tracking-tight text-fg">Driver Wallets</h1>
                    <p className="mt-0.5 text-[13px] text-fg-2">
                        Balances, the earnings ledger, payouts, and payments that did not land.
                    </p>
                </div>
                {drivers && (
                    <p className="text-[13px] text-fg-3">
                        Float held <span className="font-mono font-semibold text-fg">{formatRupees(totalBalance)}</span>
                        <span className="mx-2">·</span>
                        <span className="tabular">{drivers.length}</span> drivers
                    </p>
                )}
            </div>

            <div className="flex gap-1 p-1 overflow-x-auto border rounded-lg bg-raised border-line w-fit max-w-full">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                                tab === t.key ? 'bg-surface text-fg' : 'text-fg-3 hover:text-fg'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'balances' && (
                <BalancesTab drivers={drivers} search={search} setSearch={setSearch} onOpen={openDriver} />
            )}
            {tab === 'ledger' && <LedgerTab driverNames={driverNames} onOpen={openDriver} />}
            {tab === 'review' && <ReviewTab driverNames={driverNames} />}
            {tab === 'withdrawals' && (
                <WithdrawalsPanel canReview={mayMoveMoney} actor={actor} driverNames={driverNames} />
            )}

            {selectedDriver && (
                <DriverWalletDrawer
                    driverId={selectedDriver}
                    driverName={driverNames[selectedDriver]}
                    canAdjust={mayMoveMoney}
                    actor={actor}
                    onClose={closeDriver}
                />
            )}
        </div>
    );
}

// ── Balances ─────────────────────────────────────────────────────────────────

function BalancesTab({ drivers, search, setSearch, onOpen }) {
    const q = search.trim().toLowerCase();
    const rows = useMemo(() => {
        const list = (drivers ?? []).filter((d) => !q
            || (d.name || '').toLowerCase().includes(q)
            || String(d.phone || '').includes(q)
            || d.id.toLowerCase().includes(q));
        // Largest balances first: that is where an error costs the most and
        // where a payout is most likely to be waiting.
        return list.sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0));
    }, [drivers, q]);

    return (
        <div className="flex flex-col gap-3">
            <div className="relative w-full sm:max-w-sm">
                <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search driver name, phone or id…" className="field pl-8"
                />
            </div>

            <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
                <div className="overflow-x-auto">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Driver</th>
                                <th className="text-right">Balance</th>
                                <th className="text-right">Total earned</th>
                                <th className="text-right">Online earned</th>
                                <th className="text-right">Trips</th>
                            </tr>
                        </thead>
                        <tbody>
                            {drivers === null ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i}><td colSpan={5}><div className="h-6 skeleton" /></td></tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-[13px] text-fg-3">No drivers match.</td></tr>
                            ) : rows.map((d) => (
                                <tr key={d.id} className="row-link" onClick={() => onOpen(d.id)}>
                                    <td>
                                        <p className="text-[13px] font-medium text-fg">{d.name || 'Unnamed'}</p>
                                        <p className="font-mono text-[10px] text-fg-3">{d.phone || d.id.slice(0, 12)}</p>
                                    </td>
                                    <td className="font-mono text-right text-fg">{formatRupees(d.walletBalance ?? 0)}</td>
                                    <td className="font-mono text-right text-fg-2">{formatRupees(d.totalEarnings ?? 0)}</td>
                                    <td className="font-mono text-right text-fg-2">{formatRupees(d.onlineEarnings ?? 0)}</td>
                                    <td className="text-right text-fg-2 tabular">{(d.totalTrips ?? 0).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Ledger (every driver) ────────────────────────────────────────────────────

function LedgerTab({ driverNames, onOpen }) {
    const [state, setState] = useState({ status: 'loading', rows: [] });

    useEffect(() => {
        let cancelled = false;
        fetchAllTransactions(50)
            .then((rows) => { if (!cancelled) setState({ status: 'ok', rows }); })
            .catch((error) => {
                console.error('Wallet ledger failed:', error);
                if (!cancelled) setState({ status: 'error', rows: [] });
            });
        return () => { cancelled = true; };
    }, []);

    if (state.status === 'loading') {
        return <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 skeleton" />)}</div>;
    }

    if (state.status === 'error') {
        return (
            <div className="p-6 border rounded-xl bg-surface border-danger/40">
                <p className="text-[13px] font-medium text-fg">The combined ledger could not be read.</p>
                <p className="mt-2 text-[12px] leading-relaxed text-fg-2">
                    A collection-group query needs two things that a per-driver query does not: an index with
                    <span className="font-mono text-fg"> COLLECTION_GROUP </span> scope on
                    <span className="font-mono text-fg"> wallet_transactions.createdAt</span>, and a rule matching
                    <span className="font-mono text-fg"> /&#123;path=**&#125;/wallet_transactions/&#123;id&#125;</span>.
                    Both are in this repo — deploy rules and indexes.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
            <div className="overflow-x-auto">
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>Driver</th><th>Type</th>
                            <th className="text-right">Amount</th><th className="text-right">Balance after</th>
                            <th>Ride</th><th>When</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.rows.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-[13px] text-fg-3">
                                No wallet entries yet. Rows appear here as online ride payments settle.
                            </td></tr>
                        ) : state.rows.map((t) => {
                            const debit = t.direction === 'debit';
                            const Arrow = debit ? ArrowUpRight : ArrowDownLeft;
                            return (
                                <tr key={`${t.driverId}-${t.id}`}>
                                    <td>
                                        {t.driverId ? (
                                            <button type="button" onClick={() => onOpen(t.driverId)} className="text-[13px] text-link hover:underline">
                                                {driverNames[t.driverId] || `${t.driverId.slice(0, 10)}…`}
                                            </button>
                                        ) : <span className="text-fg-3">—</span>}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] text-fg">{txnTypeLabel(t.type)}</span>
                                            {legLabel(t.leg) && <span className="pill pill-neutral">{legLabel(t.leg)}</span>}
                                        </div>
                                    </td>
                                    <td className={`text-right font-mono ${toneText(directionTone(t.direction))}`}>
                                        <span className="inline-flex items-center gap-1">
                                            <Arrow className="w-3 h-3" />{formatSignedPaise(t.amountPaise, t.direction)}
                                        </span>
                                    </td>
                                    <td className="font-mono text-right text-fg-2">{formatPaise(t.balanceAfterPaise)}</td>
                                    <td>
                                        {t.rideId
                                            ? <Link to={`/rides?ride=${t.rideId}`} className="font-mono text-[11px] text-link hover:underline">{t.rideId.slice(0, 10)}…</Link>
                                            : <span className="text-fg-3">—</span>}
                                    </td>
                                    <td className="text-[12px] whitespace-nowrap text-fg-3" title={formatDateTime(t.createdAt)}>
                                        {formatAge(t.createdAt)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Needs review ─────────────────────────────────────────────────────────────

function ReviewTab({ driverNames }) {
    const [state, setState] = useState({ status: 'loading', rows: [] });

    useEffect(() => {
        let cancelled = false;
        fetchCreditsNeedingReview()
            .then((rows) => { if (!cancelled) setState({ status: 'ok', rows }); })
            .catch((error) => {
                console.error('Review queue failed:', error);
                if (!cancelled) setState({ status: 'error', rows: [] });
            });
        return () => { cancelled = true; };
    }, []);

    if (state.status === 'loading') {
        return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>;
    }

    if (state.status === 'error') {
        return (
            <div className="p-6 border rounded-xl bg-surface border-danger/40">
                <p className="text-[13px] text-fg-2">The review queue could not be read.</p>
            </div>
        );
    }

    if (state.rows.length === 0) {
        return (
            <div className="py-14 text-center border rounded-xl bg-surface border-line">
                <Wallet className="w-6 h-6 mx-auto mb-2 text-ok opacity-70" />
                <p className="text-[13px] font-medium text-fg">Every online payment has settled.</p>
                <p className="mt-1 text-[12px] text-fg-3">
                    Rides appear here only when a payment did not reach a driver’s wallet.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[12px] text-fg-2">
                <span className="font-semibold text-fg tabular">{state.rows.length}</span> ride
                {state.rows.length === 1 ? '' : 's'} where an online payment did not reach the driver.
                Duplicates are already filtered out — everything below needs a person.
            </p>

            {state.rows.map((ride) => (
                <div key={ride.id} className="p-4 border rounded-xl bg-surface border-line lift">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[13px] font-medium text-fg truncate">
                                {ride.pickupAddress || 'Pickup'} <span className="text-fg-3">→</span> {ride.destinationAddress || 'Drop'}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-fg-3">
                                {driverNames[ride.assignedDriverId] || ride.assignedDriverId || 'no driver'}
                                <span className="mx-1.5">·</span>{formatAge(ride.requestTime)}
                                <span className="mx-1.5">·</span>{formatCurrency(ride.fare)}
                            </p>
                        </div>
                        <Link to={`/rides?ride=${ride.id}`} className="flex items-center gap-1 text-[12px] text-link hover:underline shrink-0">
                            Open ride <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-line/60">
                        {ride.brokenLegs.map((entry) => {
                            const meta = creditStatusMeta(entry.status);
                            return (
                                <div key={entry.leg} className="flex flex-wrap items-start gap-2">
                                    <span className={`pill pill-${meta.tone} shrink-0`}>{meta.label}</span>
                                    {legLabel(entry.leg) && <span className="pill pill-neutral shrink-0">{legLabel(entry.leg)}</span>}
                                    <p className="flex-1 min-w-[16rem] text-[12px] leading-relaxed text-fg-2">
                                        {meta.blurb}
                                        {entry.reason && <span className="text-fg-3"> — {entry.reason}</span>}
                                    </p>
                                    <div className="text-right shrink-0">
                                        {typeof entry.amountPaise === 'number' && (
                                            <p className="font-mono text-[12px] text-fg">{formatPaise(entry.amountPaise)}</p>
                                        )}
                                        {/* Only shown when it differs — on a mismatch the gap is the whole point. */}
                                        {typeof entry.expectedPaise === 'number' && entry.expectedPaise !== entry.amountPaise && (
                                            <p className="font-mono text-[10px] text-warn">expected {formatPaise(entry.expectedPaise)}</p>
                                        )}
                                        {entry.paymentId && <p className="font-mono text-[10px] text-fg-3">{entry.paymentId}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Per-driver drawer ────────────────────────────────────────────────────────

function DriverWalletDrawer({ driverId, driverName, canAdjust, actor, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-fg/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative flex flex-col w-full h-full max-w-2xl border-l bg-canvas border-line">
                <div className="flex items-center justify-between px-5 py-4 border-b bg-surface border-line">
                    <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold truncate text-fg">{driverName || 'Driver wallet'}</h2>
                        <p className="font-mono text-[11px] text-fg-3 truncate">{driverId}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-fg-3 hover:text-fg hover:bg-raised">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                    {/* Keyed by driver: switching driver remounts with clean state rather
                        than briefly rendering the previous driver's balance. */}
                    <DriverWalletPanel key={driverId} driverId={driverId} driverName={driverName} canAdjust={canAdjust} actor={actor} />
                </div>
            </div>
        </div>
    );
}
