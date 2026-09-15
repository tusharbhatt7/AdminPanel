import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Star, AlertCircle } from 'lucide-react';
import { formatDateTime } from '../lib/rideStatus';
import { looksEncrypted } from '../lib/pii';

export default function Reviews() {
    const [state, setState] = useState({ status: 'loading', rows: [] });
    const [minRating, setMinRating] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'ratings'));
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
                if (!cancelled) setState({ status: 'ok', rows });
            } catch (error) {
                console.error('Reviews failed:', error);
                if (!cancelled) setState({ status: 'error', rows: [] });
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const rows = minRating ? state.rows.filter((r) => r.rating <= minRating) : state.rows;
    const avg = state.rows.length
        ? (state.rows.reduce((a, r) => a + (r.rating || 0), 0) / state.rows.length).toFixed(2)
        : null;
    const withFeedback = state.rows.filter((r) => r.feedback && r.feedback.trim()).length;

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-[20px] font-bold tracking-tight text-fg">Reviews</h1>
                <p className="mt-0.5 text-[13px] text-fg-2">Post-ride ratings and issue reports.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Total reviews', value: state.rows.length },
                    { label: 'Average rating', value: avg ?? '—' },
                    { label: 'With written feedback', value: withFeedback },
                    { label: 'Low ratings (≤2)', value: state.rows.filter((r) => r.rating <= 2).length },
                ].map((s) => (
                    <div key={s.label} className="p-3 border rounded-xl bg-surface border-line lift">
                        <p className="text-[20px] font-bold leading-none text-fg tabular">{s.value}</p>
                        <p className="mt-1.5 text-[11px] text-fg-3">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor="min-rating" className="text-[12px] text-fg-3">Show</label>
                <select id="min-rating" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="field w-auto">
                    <option value={0}>All reviews</option>
                    <option value={2}>Low ratings only (≤2)</option>
                    <option value={3}>3 stars and below</option>
                </select>
            </div>

            {state.status === 'loading' ? (
                <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 skeleton" />)}</div>
            ) : state.status === 'error' ? (
                <div className="p-6 text-center border rounded-xl bg-surface border-danger/40">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-danger" />
                    <p className="text-[13px] text-fg-2">Could not load reviews.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden border rounded-xl bg-surface border-line lift">
                        <div className="overflow-x-auto">
                            <table className="tbl">
                                <thead>
                                    <tr><th>Rating</th><th>Driver</th><th>Vehicle</th><th>Feedback</th><th className="text-right">Fare</th><th>When</th></tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-[13px] text-fg-3">No reviews match.</td></tr>
                                    ) : rows.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <span className={`pill ${r.rating >= 4 ? 'pill-ok' : r.rating >= 3 ? 'pill-warn' : 'pill-danger'}`}>
                                                    <Star className="w-3 h-3" /> {r.rating}
                                                </span>
                                            </td>
                                            <td className="text-fg">{r.driverName || '—'}</td>
                                            <td>
                                                {looksEncrypted(r.vehicleNumber)
                                                    ? <span className="font-mono text-[10px] text-fg-3">encrypted</span>
                                                    : <span className="font-mono text-[11px]">{r.vehicleNumber || '—'}</span>}
                                            </td>
                                            <td className="text-fg-2">
                                                {r.feedback?.trim() || <span className="text-fg-3 italic">no comment left</span>}
                                            </td>
                                            <td className="font-mono text-right">₹{r.fareAmount ?? '—'}</td>
                                            <td className="text-[12px] whitespace-nowrap text-fg-3">{formatDateTime(r.timestamp)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {withFeedback === 0 && state.rows.length > 0 && (
                        <p className="text-[11px] text-fg-3">
                            Every review has an empty feedback field and an empty issues array — the rider app appears not to
                            collect them, so there is nothing for a safety workflow to act on yet.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
