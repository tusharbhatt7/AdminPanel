import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Smartphone, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import {
    listenWithdrawalRequests, fetchBankAccount,
    approveWithdrawal, rejectWithdrawal,
} from '../services/walletService';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService';
import { formatPaise, toPaise, withdrawalStatusMeta, payoutDestination, maskAccount } from '../lib/wallet';
import { formatDateTime, formatAge } from '../lib/rideStatus';

const FILTERS = [
    { key: 'pending', label: 'Pending' },
    { key: null, label: 'All' },
];

/**
 * The payout queue.
 *
 * The order of operations matters and the UI enforces it: the bank transfer
 * happens outside this panel first, and approval records its UTR. Approving
 * without one would leave the ledger asserting a payout that nobody can trace,
 * so the reference is required rather than optional.
 *
 * Rejecting returns the held amount to the driver's wallet — the callable does
 * that server-side, in the same transaction as the status change.
 */
export default function WithdrawalsPanel({ canReview = false, actor = null, driverNames = {} }) {
    const [filter, setFilter] = useState('pending');
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    const [accounts, setAccounts] = useState({});
    const [acting, setActing] = useState(null);

    useEffect(() => {
        setRows(null); setError(null);
        return listenWithdrawalRequests(setRows, (e) => { setRows([]); setError(e); }, { status: filter });
    }, [filter]);

    // Payout destinations are a second collection. Fetched once per account id
    // as rows arrive, and cached — the pending queue is usually the same few
    // drivers and refetching on every snapshot would be a read per tick.
    useEffect(() => {
        if (!rows?.length) return;
        const missing = [...new Set(rows.map((r) => r.bankAccountId).filter((id) => id && !(id in accounts)))];
        if (!missing.length) return;

        let cancelled = false;
        (async () => {
            const fetched = await Promise.all(
                missing.map(async (id) => [id, await fetchBankAccount(id).catch(() => null)]),
            );
            if (!cancelled) setAccounts((prev) => ({ ...prev, ...Object.fromEntries(fetched) }));
        })();
        return () => { cancelled = true; };
    }, [rows, accounts]);

    const pendingTotal = useMemo(
        () => (rows ?? []).filter((r) => r.status === 'pending')
            .reduce((sum, r) => sum + (toPaise(r.amountPaise, r.amount) ?? 0), 0),
        [rows],
    );

    const act = useCallback(async (request, action, value) => {
        setActing(request.id);
        const amountPaise = toPaise(request.amountPaise, request.amount);
        try {
            if (action === 'approve') await approveWithdrawal(request.id, value);
            else await rejectWithdrawal(request.id, value);

            await recordAudit({
                actor,
                action: action === 'approve' ? AUDIT_ACTIONS.WITHDRAWAL_APPROVED : AUDIT_ACTIONS.WITHDRAWAL_REJECTED,
                targetType: 'withdrawal_request',
                targetId: request.id,
                targetLabel: driverNames[request.userId] || request.userId,
                metadata: action === 'approve'
                    ? { amountPaise, payoutReference: value }
                    : { amountPaise, reason: value },
            });

            toast.success(action === 'approve'
                ? `Approved ${formatPaise(amountPaise)}`
                : 'Rejected — the amount is back in the driver wallet');
        } catch (e) {
            console.error('reviewWithdrawal failed:', e);
            toast.error(e?.message || 'The action failed.');
        } finally {
            setActing(null);
        }
    }, [actor, driverNames]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 p-1 border rounded-lg bg-raised border-line">
                    {FILTERS.map((f) => (
                        <button
                            key={f.label} type="button" onClick={() => setFilter(f.key)}
                            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                                filter === f.key ? 'bg-surface text-fg' : 'text-fg-3 hover:text-fg'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                {pendingTotal > 0 && (
                    <p className="text-[12px] text-fg-3">
                        Pending payouts <span className="font-mono font-semibold text-fg">{formatPaise(pendingTotal)}</span>
                    </p>
                )}
            </div>

            {!canReview && (
                <p className="flex items-start gap-2 p-3 text-[12px] leading-relaxed border rounded-lg border-line bg-raised text-fg-2">
                    <AlertCircle className="w-4 h-4 mt-px shrink-0 text-fg-3" />
                    Your role can see the queue but not act on it. Approving or rejecting a payout needs
                    the <span className="font-mono text-fg">wallets.write</span> permission.
                </p>
            )}

            {error && (
                <p className="p-3 text-[12px] border rounded-lg border-danger/40 bg-danger-soft text-fg-2">
                    The queue could not be loaded. The pending view needs the
                    <span className="font-mono text-fg"> status + requestedAt </span> index.
                </p>
            )}

            <div className="flex flex-col gap-2">
                {rows === null ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)
                ) : rows.length === 0 ? (
                    <div className="py-12 text-center border rounded-xl bg-surface border-line">
                        <Banknote className="w-6 h-6 mx-auto mb-2 text-fg-3 opacity-50" />
                        <p className="text-[13px] text-fg-3">
                            {filter === 'pending' ? 'No payouts waiting.' : 'No withdrawal requests yet.'}
                        </p>
                    </div>
                ) : rows.map((r) => (
                    <WithdrawalRow
                        key={r.id}
                        request={r}
                        account={accounts[r.bankAccountId]}
                        driverName={driverNames[r.userId]}
                        canReview={canReview}
                        busy={acting === r.id}
                        onAct={act}
                    />
                ))}
            </div>
        </div>
    );
}

function WithdrawalRow({ request, account, driverName, canReview, busy, onAct }) {
    const [mode, setMode] = useState(null); // 'approve' | 'reject'
    const [value, setValue] = useState('');

    const status = withdrawalStatusMeta(request.status);
    const amountPaise = toPaise(request.amountPaise, request.amount);
    const destination = payoutDestination(account);
    const isPending = request.status === 'pending';
    // A UTR and a rejection reason are both free text; four characters is the
    // bar for either, enough to reject an accidental keypress.
    const valid = value.trim().length >= 4;

    const submit = async () => {
        await onAct(request, mode, value.trim());
        setMode(null); setValue('');
    };

    return (
        <div className="p-4 border rounded-xl bg-surface border-line lift">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-fg">{driverName || request.userId}</p>
                        <span className={`pill pill-${status.tone}`}>{status.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-3" title={formatDateTime(request.requestedAt)}>
                        Requested {formatAge(request.requestedAt)}
                    </p>
                </div>
                <p className="font-mono text-[18px] font-semibold text-fg">{formatPaise(amountPaise)}</p>
            </div>

            {/* Where the money goes. A UPI request has no account number at all,
                so it renders as a UPI ID rather than two blank bank fields. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 pt-3 border-t border-line/60">
                {!account ? (
                    <p className="text-[12px] text-fg-3">
                        {request.bankAccountId ? 'Loading payout details…' : 'No payout destination on this request.'}
                    </p>
                ) : destination.isUpi ? (
                    <>
                        <Field icon={Smartphone} label="UPI ID" value={destination.upiId || '—'} mono />
                        <Field label="Name" value={destination.holder || '—'} />
                    </>
                ) : (
                    <>
                        <Field icon={Banknote} label="Bank" value={destination.bankName || '—'} />
                        <Field label="Account" value={maskAccount(destination.accountNumber) || '—'} mono />
                        <Field label="IFSC" value={destination.ifsc || '—'} mono />
                        <Field label="Name" value={destination.holder || '—'} />
                    </>
                )}
            </div>

            {request.payoutReference && (
                <p className="mt-2 text-[11px] text-fg-3">
                    UTR <span className="font-mono text-fg-2">{request.payoutReference}</span>
                </p>
            )}
            {request.rejectionReason && (
                <p className="mt-2 text-[11px] text-fg-3">Reason: {request.rejectionReason}</p>
            )}

            {isPending && canReview && (
                mode === null ? (
                    <div className="flex gap-2 mt-4">
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setMode('approve'); setValue(''); }}>
                            <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => { setMode('reject'); setValue(''); }}>
                            <X className="w-3.5 h-3.5" /> Reject
                        </button>
                    </div>
                ) : (
                    <div className="mt-4">
                        <label className="field-label" htmlFor={`v-${request.id}`}>
                            {mode === 'approve' ? 'Bank transfer reference (UTR)' : 'Reason for rejection'}
                        </label>
                        <input
                            id={`v-${request.id}`} className="field" value={value} autoFocus
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={mode === 'approve' ? 'e.g. N123456789012345' : 'Told to the driver'}
                        />
                        <p className="mt-1 text-[11px] text-fg-3">
                            {mode === 'approve'
                                ? 'Send the transfer first, then record its UTR here. Approval does not move money by itself.'
                                : 'The held amount returns to the driver’s wallet automatically.'}
                        </p>
                        <div className="flex justify-end gap-2 mt-3">
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMode(null)}>Cancel</button>
                            <button
                                type="button" disabled={!valid || busy} onClick={submit}
                                className={`btn btn-sm ${mode === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                            >
                                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                            </button>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}

const Field = ({ icon: Icon, label, value, mono }) => (
    <div>
        <div className="flex items-center gap-1">
            {Icon && <Icon className="w-3 h-3 text-fg-3" />}
            <span className="eyebrow">{label}</span>
        </div>
        <p className={`text-[12px] text-fg ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
);
