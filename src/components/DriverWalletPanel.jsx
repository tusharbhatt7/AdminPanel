import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, Route as RouteIcon, Smartphone, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { listenDriverBalance, listenDriverTransactions, adjustWallet } from '../services/walletService';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService';
import {
    formatPaise, formatRupees, formatSignedPaise, txnTypeLabel,
    legLabel, sourceLabel, directionTone,
} from '../lib/wallet';
import { toneText } from '../lib/tones';
import { formatDateTime, formatAge, toDate } from '../lib/rideStatus';

// How long a freshly written ledger row is allowed to disagree with the driver
// document before the mismatch is treated as real rather than in-flight.
const SETTLE_GRACE_MS = 20_000;

const Stat = ({ icon: Icon, label, value, muted }) => (
    <div className="p-3 border rounded-lg bg-raised border-line">
        <div className="flex items-center gap-1.5 mb-1">
            {Icon && <Icon className="w-3 h-3 text-fg-3" />}
            <span className="eyebrow">{label}</span>
        </div>
        <p className={`font-mono text-[15px] font-semibold ${muted ? 'text-fg-2' : 'text-fg'}`}>{value}</p>
    </div>
);

/**
 * One driver's balance and ledger, live.
 *
 * The balance tile and the ledger are two listeners on the same money, so they
 * can briefly disagree while a credit lands. That is the honest view: the
 * balance on the driver document is what the driver's app shows, and the
 * ledger is how it got there. If they stop agreeing for more than a moment,
 * that is a real problem worth seeing rather than one worth smoothing over.
 */
export default function DriverWalletPanel({ driverId, driverName, canAdjust = false, actor = null }) {
    const [balance, setBalance] = useState(null);
    const [txns, setTxns] = useState(null);
    const [error, setError] = useState(null);
    const [adjusting, setAdjusting] = useState(false);

    // A clock in state rather than Date.now() inside the memo below. Reading
    // the real clock during render is impure, and worse here it would be read
    // only when `txns` changed — so a row that was still settling would stay
    // excused forever and a genuine mismatch would never surface. Starting at
    // 0 means the first render excuses everything, which is the safe default:
    // no false alarm before the first tick.
    const [now, setNow] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, []);

    // No state reset here: the call site keys this component by driverId, so a
    // different driver remounts it with fresh state. Resetting inside the
    // effect instead would render once with the previous driver's balance
    // before clearing it — a real wrong-number flash on a money screen.
    useEffect(() => {
        if (!driverId) return undefined;

        const stopBalance = listenDriverBalance(driverId, setBalance, () => setError('balance'));
        const stopTxns = listenDriverTransactions(driverId, setTxns, () => { setTxns([]); setError('ledger'); });
        return () => { stopBalance(); stopTxns(); };
    }, [driverId]);

    // What the ledger says the balance should be. Shown only when it disagrees
    // with the driver document — a mismatch means a balance moved without a
    // row, which is exactly what writing balances from the panel would cause.
    //
    // The balance and the ledger are two separate listeners, so during a credit
    // one arrives a moment before the other and they legitimately disagree.
    // A row younger than SETTLE_GRACE_MS is treated as still settling, or every
    // completed ride would flash an alarming banner at whoever is watching.
    const ledgerTip = useMemo(() => {
        const newest = txns?.[0];
        if (typeof newest?.balanceAfterPaise !== 'number') return null;
        const writtenAt = toDate(newest.createdAt)?.getTime() ?? 0;
        if (now - writtenAt < SETTLE_GRACE_MS) return null;
        return newest.balanceAfterPaise;
    }, [txns, now]);

    const walletPaise = typeof balance?.walletBalance === 'number' ? Math.round(balance.walletBalance * 100) : null;
    const drift = ledgerTip !== null && walletPaise !== null && ledgerTip !== walletPaise;

    if (!driverId) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Stat icon={Wallet} label="Balance" value={balance ? formatRupees(balance.walletBalance) : '…'} />
                <Stat icon={TrendingUp} label="Total earned" value={balance ? formatRupees(balance.totalEarnings) : '…'} muted />
                <Stat icon={Smartphone} label="Online earned" value={balance ? formatRupees(balance.onlineEarnings) : '…'} muted />
                <Stat icon={RouteIcon} label="Trips" value={balance ? (balance.totalTrips ?? 0).toLocaleString('en-IN') : '…'} muted />
            </div>

            {drift && (
                <div className="flex items-start gap-2 p-3 border rounded-lg border-warn/40 bg-warn-soft">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                    <p className="text-[12px] leading-relaxed text-fg-2">
                        The wallet balance is <span className="font-mono text-fg">{formatPaise(walletPaise)}</span> but the
                        newest ledger row ends at <span className="font-mono text-fg">{formatPaise(ledgerTip)}</span>.
                        A balance has moved without a matching entry — the ledger can no longer explain this driver's money.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-fg">Wallet history</h3>
                {canAdjust && (
                    <button type="button" className="btn btn-default btn-sm" onClick={() => setAdjusting(true)}>
                        <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust balance
                    </button>
                )}
            </div>

            {error === 'ledger' && (
                <p className="text-[12px] text-fg-3">
                    The ledger could not be read. A collection-group index and rule are needed for
                    <span className="font-mono text-fg"> wallet_transactions</span> — see firestore.rules.
                </p>
            )}

            <div className="overflow-hidden border rounded-lg bg-surface border-line">
                <div className="overflow-x-auto">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th className="text-right">Amount</th>
                                <th className="text-right">Balance after</th>
                                <th>Reference</th>
                                <th>When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {txns === null ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i}><td colSpan={5}><div className="h-6 skeleton" /></td></tr>
                                ))
                            ) : txns.length === 0 ? (
                                <tr><td colSpan={5} className="py-10 text-center text-[13px] text-fg-3">
                                    No wallet entries yet.
                                </td></tr>
                            ) : txns.map((t) => {
                                const debit = t.direction === 'debit';
                                const Arrow = debit ? ArrowUpRight : ArrowDownLeft;
                                return (
                                    <tr key={t.id}>
                                        <td>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[13px] text-fg">{txnTypeLabel(t.type)}</span>
                                                {legLabel(t.leg) && <span className="pill pill-neutral">{legLabel(t.leg)}</span>}
                                            </div>
                                            <p className="text-[11px] text-fg-3">
                                                {t.description || sourceLabel(t.source) || t.status || '—'}
                                            </p>
                                        </td>
                                        <td className={`text-right font-mono ${toneText(directionTone(t.direction))}`}>
                                            <span className="inline-flex items-center gap-1">
                                                <Arrow className="w-3 h-3" />
                                                {formatSignedPaise(t.amountPaise, t.direction)}
                                            </span>
                                        </td>
                                        <td className="font-mono text-right text-fg-2">{formatPaise(t.balanceAfterPaise)}</td>
                                        <td>
                                            {t.rideId ? (
                                                <Link to={`/rides?ride=${t.rideId}`} className="font-mono text-[11px] text-link hover:underline">
                                                    {t.rideId.slice(0, 10)}…
                                                </Link>
                                            ) : <span className="text-fg-3">—</span>}
                                            {t.paymentId && <div className="font-mono text-[10px] text-fg-3">{t.paymentId}</div>}
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

            {adjusting && (
                <AdjustDialog
                    driverId={driverId}
                    driverName={driverName}
                    actor={actor}
                    onClose={() => setAdjusting(false)}
                />
            )}
        </div>
    );
}

/**
 * Manual correction. The amount is typed in rupees because that is what the
 * driver and the operator are both looking at, and converted to integer paise
 * at the boundary — the callable takes paise, and parsing "12.34" to 1234 once
 * here is safer than letting a float travel.
 */
function AdjustDialog({ driverId, driverName, actor, onClose }) {
    const [amount, setAmount] = useState('');
    const [direction, setDirection] = useState('credit');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const amountPaise = Math.round(Number(amount) * 100);
    const valid = Number.isFinite(amountPaise) && amountPaise > 0 && reason.trim().length >= 4;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
            await adjustWallet({ driverId, amountPaise, direction, reason: reason.trim() });
            // The function writes its own ledger row; this records who in the
            // panel asked for it, which the ledger row alone does not say.
            await recordAudit({
                actor,
                action: AUDIT_ACTIONS.WALLET_ADJUSTED,
                targetType: 'driver',
                targetId: driverId,
                targetLabel: driverName || driverId,
                metadata: { amountPaise, direction, reason: reason.trim() },
            });
            toast.success(`Wallet ${direction === 'credit' ? 'credited' : 'debited'} ${formatPaise(amountPaise)}`);
            onClose();
        } catch (error) {
            console.error('adminAdjustWallet failed:', error);
            toast.error(error?.message || 'Adjustment failed.');
            await recordAudit({
                actor,
                action: AUDIT_ACTIONS.WALLET_ADJUSTED,
                targetType: 'driver',
                targetId: driverId,
                targetLabel: driverName || driverId,
                status: 'failure',
                metadata: { amountPaise, direction, error: error?.code || String(error?.message || error) },
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/40 backdrop-blur-sm">
            <form onSubmit={submit} className="w-full max-w-sm p-5 border rounded-xl bg-surface border-line lift">
                <h3 className="text-[15px] font-semibold text-fg">Adjust wallet</h3>
                <p className="mt-1 mb-4 text-[12px] text-fg-2">
                    {driverName || driverId}. This writes a ledger entry and moves the balance together — it cannot be undone
                    except by a second adjustment.
                </p>

                <div className="flex gap-2 mb-3">
                    {['credit', 'debit'].map((d) => (
                        <button
                            key={d} type="button" onClick={() => setDirection(d)}
                            className={`btn flex-1 ${direction === d ? 'btn-primary' : 'btn-default'}`}
                        >
                            {d === 'credit' ? 'Credit' : 'Debit'}
                        </button>
                    ))}
                </div>

                <label className="field-label" htmlFor="adjust-amount">Amount (₹)</label>
                <input
                    id="adjust-amount" type="number" min="0.01" step="0.01" value={amount}
                    onChange={(e) => setAmount(e.target.value)} className="field" placeholder="0.00" required
                />

                <label className="field-label mt-3" htmlFor="adjust-reason">Reason</label>
                <textarea
                    id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                    className="field" rows={3} placeholder="Why this correction is being made" required
                />
                <p className="mt-1 text-[11px] text-fg-3">Stored on the ledger row and the audit log.</p>

                <div className="flex justify-end gap-2 mt-5">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
                        {busy ? 'Applying…' : `${direction === 'credit' ? 'Credit' : 'Debit'} ${amountPaise > 0 ? formatPaise(amountPaise) : ''}`}
                    </button>
                </div>
            </form>
        </div>
    );
}
