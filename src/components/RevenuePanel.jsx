import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useCountUp } from '../lib/useCountUp';

/** Daily revenue from completed-ride fares. */
export default function RevenuePanel({ days, total, change, loading = false }) {
    const [hover, setHover] = useState(null);
    const shown = useCountUp(typeof total === 'number' ? Math.round(total) : null);

    const model = useMemo(() => {
        if (!days?.length) return null;
        const max = Math.max(1, ...days.map((d) => d.revenue));
        return { max, earning: days.filter((d) => d.revenue > 0).length };
    }, [days]);

    const up = typeof change === 'number' && change >= 0;
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

    if (loading) return <div className="flex flex-col gap-3"><div className="w-40 h-8 skeleton" /><div className="h-40 skeleton" /></div>;
    if (!model) return <p className="py-12 text-[13px] text-center text-fg-3">No revenue in this window.</p>;

    const { max, earning } = model;
    const W = 1000;
    const H = 150;
    const slot = W / days.length;
    const barW = Math.max(slot * 0.6, 1.5);

    return (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
            <div>
                <div className="flex items-baseline gap-2.5">
                    <span className="text-[26px] font-bold leading-none tracking-tight text-fg tabular">
                        ₹{shown.toLocaleString('en-IN')}
                    </span>
                    {typeof change === 'number' && (
                        <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${up ? 'text-ok' : 'text-danger'}`}>
                            {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(change)}%
                        </span>
                    )}
                </div>
                <p className="mt-1 text-[11px] text-fg-3">
                    Fare value of completed rides &middot; {earning} of {days.length} days earned
                </p>
            </div>

            <div className="relative flex-1 min-h-[120px]">
                <svg
                    viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                    role="img" className="w-full h-full overflow-visible"
                    aria-label={`Daily revenue, peak ${money(max)} in a day, ${money(total || 0)} in total.`}
                    onMouseLeave={() => setHover(null)}
                >
                    <g className="chart-grid">
                        <line x1={0} y1={H} x2={W} y2={H} />
                        <line x1={0} y1={H / 2} x2={W} y2={H / 2} strokeDasharray="2 6" />
                        <line x1={0} y1={2} x2={W} y2={2} strokeDasharray="2 6" />
                    </g>
                    {days.map((d, i) => {
                        const h = d.revenue ? Math.max((d.revenue / max) * (H - 4), 3) : 0;
                        return (
                            <g key={d.date.toISOString()}>
                                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
                                {h > 0 && (
                                    <rect
                                        x={i * slot + (slot - barW) / 2} y={H - h} width={barW} height={h} rx={2}
                                        fill="var(--c-series-active)"
                                        opacity={hover !== null && hover !== i ? 0.4 : 1}
                                        pointerEvents="none" style={{ transition: 'opacity 120ms' }}
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {hover !== null && days[hover] && (
                    <div
                        className="tooltip top-1"
                        style={{
                            left: `${Math.min(Math.max((hover + 0.5) / days.length, 0.1), 0.9) * 100}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <span className="font-mono font-semibold">{money(days[hover].revenue)}</span>
                        <span className="text-fg-3"> &middot; {fmt(days[hover].date)}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-fg-3">
                <span>{fmt(days[0].date)}</span>
                <span>{fmt(days[days.length - 1].date)}</span>
            </div>
        </div>
    );
}
