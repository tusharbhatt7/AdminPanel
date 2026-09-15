import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, AlertCircle } from 'lucide-react';
import { formatDateTime, toDate } from '../lib/rideStatus';
import { looksEncrypted } from '../lib/pii';

const money = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export default function Payments() {
    const [state, setState] = useState({ status: 'loading', rows: [] });
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                let snap;
                try {
                    snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
                } catch {
                    snap = await getDocs(collection(db, 'payments'));
                }
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
                if (!cancelled) setState({ status: 'ok', rows });
            } catch (error) {
                console.error('Payments failed:', error);
                if (!cancelled) setState({ status: 'error', rows: [] });
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const q = search.trim().toLowerCase();
    const rows = q
        ? state.rows.filter((p) => [p.paymentId, p.userName, p.userEmail, p.status, p.paymentMethod, p.rideId]
            .some((f) => f && String(f).toLowerCase().includes(q)))
        : state.rows;

    const total = rows.reduce((a, p) => a + (typeof p.amount === 'number' ? p.amount : 0), 0);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-[20px] font-bold tracking-tight text-fg">Payments</h1>
                <p className="mt-0.5 text-[13px] text-fg-2">Razorpay transaction ledger.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search payment ID, customer, status…"
                        className="field pl-8"
                    />
                </div>
                <p className="text-[13px] text-fg-3">
                    <span className="font-semibold text-fg tabular">{rows.length}</span> payments
                    <span className="mx-2">·</span>
                    <span className="font-mono font-semibold text-fg">{money(total)}</span>
                </p>
            </div>

            {state.status === 'loading' ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton" />)}
                </div>
            ) : state.status === 'error' ? (
                <div className="p-6 text-center border rounded-xl bg-surface border-danger/40">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-danger" />
                    <p className="text-[13px] text-fg-2">Could not load payments.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
                        <div className="overflow-x-auto">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th>Payment ID</th><th>Customer</th><th>Driver</th>
                                        <th className="text-right">Amount</th><th>Method</th><th>Status</th><th>When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={7} className="py-12 text-center text-[13px] text-fg-3">
                                            No payments match.
                                        </td></tr>
                                    ) : rows.map((p) => (
                                        <tr key={p.id}>
                                            <td className="font-mono text-[11px] text-fg">{p.paymentId || p.id}</td>
                                            <td>{p.userName || p.userEmail || '—'}</td>
                                            <td>
                                                {p.driverName || <span className="text-fg-3">—</span>}
                                                {looksEncrypted(p.vehicleNumber)
                                                    ? <div className="font-mono text-[10px] text-fg-3">encrypted</div>
                                                    : p.vehicleNumber && <div className="font-mono text-[10px] text-fg-3">{p.vehicleNumber}</div>}
                                            </td>
                                            <td className="font-mono text-right text-fg">{money(p.amount)}</td>
                                            <td className="text-fg-2">{p.paymentMethod || '—'}</td>
                                            <td>
                                                <span className={`pill ${p.status === 'success' ? 'pill-ok' : 'pill-danger'}`}>
                                                    {p.status || 'unknown'}
                                                </span>
                                            </td>
                                            <td className="text-[12px] whitespace-nowrap text-fg-3">{formatDateTime(p.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <p className="text-[11px] text-fg-3">
                        Only {state.rows.length} payment records exist against 65 completed rides — most completed rides
                        never produced one, and none carry a driverId. See the schema audit.
                    </p>
                </>
            )}
        </div>
    );
}
