import React, { useState, useMemo } from 'react';

// Same validated four-colour set as the outcome bar, in the same fixed order.
const SERIES = [
    { key: 'completed', label: 'Completed', color: 'var(--c-series-completed)' },
    { key: 'ongoing', label: 'Ongoing', color: 'var(--c-series-active)' },
    { key: 'pending', label: 'Pending', color: 'var(--c-series-pending)' },
    { key: 'cancelled', label: 'Cancelled', color: 'var(--c-series-cancelled)' },
];

/**
 * Daily rides split by outcome. Grouped bars rather than the mockup's lines:
 * this platform's activity is bursty — most days in any window have no rides at
 * all — and a line would draw slopes through gaps that are genuinely zero.
 */
export default function RidesOverviewChart({ days, loading = false }) {
    const [hover, setHover] = useState(null);

    const model = useMemo(() => {
        if (!days?.length) return null;
        const max = Math.max(1, ...days.map((d) => d.completed + d.ongoing + d.pending + d.cancelled));
        const ticks = [0, Math.round(max / 2), max];
        return { max, ticks };
    }, [days]);

    if (loading) return <div className="h-48 skeleton" />;
    if (!model) return <p className="py-12 text-[13px] text-center text-fg-3">No rides in this window.</p>;

    const { max, ticks } = model;
    const W = 1000;
    const H = 190;
    const slot = W / days.length;
    const barW = Math.max(slot * 0.62, 1.5);
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    return (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="flex flex-1 min-h-0 gap-3">
                {/* y axis in HTML so the type never scales with the viewBox */}
                <div className="flex flex-col justify-between h-full min-h-[150px] font-mono text-[10px] text-fg-3 tabular shrink-0">
                    {[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}
                </div>

                <div className="relative flex-1 min-w-0 h-full">
                    <svg
                        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                        role="img" className="w-full h-full overflow-visible"
                        aria-label={`Daily rides by outcome across ${days.length} days, peak ${max} in a day.`}
                        onMouseLeave={() => setHover(null)}
                    >
                        <g className="chart-grid">
                            {ticks.map((t) => {
                                const y = H - (t / max) * H;
                                return <line key={t} x1={0} y1={y} x2={W} y2={y} strokeDasharray={t === 0 ? undefined : '2 6'} />;
                            })}
                        </g>

                        {days.map((d, i) => {
                            const total = d.completed + d.ongoing + d.pending + d.cancelled;
                            const dim = hover !== null && hover !== i;
                            // stacked: one column per day, 2px surface gap between segments
                            const segs = SERIES.map((s) => ({ ...s, v: d[s.key] })).filter((s) => s.v > 0);
                            const heights = segs.map((s) => (s.v / max) * H);
                            return (
                                <g key={d.date.toISOString()}>
                                    <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
                                    {segs.map((s, j) => {
                                        const below = heights.slice(0, j).reduce((a, b) => a + b, 0) + 2 * j;
                                        return (
                                            <rect
                                                key={s.key}
                                                x={i * slot + (slot - barW) / 2}
                                                y={H - below - heights[j]}
                                                width={barW} height={Math.max(heights[j] - 2, 1.5)} rx={2}
                                                fill={s.color} opacity={dim ? 0.35 : 1}
                                                pointerEvents="none"
                                                style={{ transition: 'opacity 120ms' }}
                                            />
                                        );
                                    })}
                                    {total === 0 && null}
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
                            <span className="font-semibold">{fmt(days[hover].date)}</span>
                            {SERIES.filter((s) => days[hover][s.key] > 0).map((s) => (
                                <span key={s.key} className="ml-2">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: s.color }} />
                                    {days[hover][s.key]}
                                </span>
                            ))}
                            {days[hover].completed + days[hover].ongoing + days[hover].pending + days[hover].cancelled === 0 && (
                                <span className="ml-2 text-fg-3">no rides</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between pl-8 font-mono text-[10px] text-fg-3">
                <span>{fmt(days[0].date)}</span>
                <span>{fmt(days[days.length - 1].date)}</span>
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-8">
                {SERIES.map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[11px] text-fg-2">{s.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
