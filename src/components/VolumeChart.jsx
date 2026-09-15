import React, { useState, useMemo } from 'react';

/**
 * Daily ride volume. Bars, not a line: activity here is bursty, with most days
 * empty, and a line would draw continuity through gaps that are genuinely zero.
 * One series, so no legend — the heading names it.
 */
export default function VolumeChart({ data, loading = false }) {
    const [hover, setHover] = useState(null);

    const model = useMemo(() => {
        if (!data?.length) return null;
        const max = Math.max(...data.map((d) => d.total), 1);
        const activeDays = data.filter((d) => d.total > 0).length;
        const total = data.reduce((a, d) => a + d.total, 0);
        const peak = data.reduce((a, d) => (d.total > a.total ? d : a), data[0]);
        return { max, activeDays, total, peak };
    }, [data]);

    if (loading) return <div className="h-24 skeleton" />;
    if (!model) return <p className="text-[13px] text-fg-3">No rides in this window.</p>;

    const { max, activeDays, total, peak } = model;
    const W = 1000;
    const H = 120;
    const slot = W / data.length;
    const barW = Math.max(slot - 1.5, 1.5);
    const fmtDay = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] text-fg-3">
                    <span className="font-mono font-semibold text-fg tabular">{total.toLocaleString('en-IN')}</span> rides
                    {' '}over <span className="font-mono tabular">{data.length}</span> days,
                    {' '}<span className="font-mono tabular">{activeDays}</span> with activity
                </p>
                <p className="font-mono text-[10px] text-fg-3 tabular">peak {max}/day</p>
            </div>

            <div className="relative">
                <svg
                    viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
                    preserveAspectRatio="none" role="img"
                    aria-label={`Daily ride volume over ${data.length} days. ${total} rides total, peak ${max} on ${fmtDay(peak.date)}.`}
                    className="overflow-visible"
                    onMouseLeave={() => setHover(null)}
                >
                    {/* recessive gridlines at the midpoint and top of scale */}
                    <g className="chart-grid">
                        <line x1={0} y1={H} x2={W} y2={H} />
                        <line x1={0} y1={H / 2} x2={W} y2={H / 2} strokeDasharray="2 6" />
                        <line x1={0} y1={2} x2={W} y2={2} strokeDasharray="2 6" />
                    </g>

                    {data.map((d, i) => {
                        const h = d.total ? Math.max((d.total / max) * (H - 4), 3) : 0;
                        const isHover = hover === i;
                        return (
                            <g key={d.date.toISOString()}>
                                {/* hit target spans the full column height */}
                                <rect
                                    x={i * slot} y={0} width={slot} height={H}
                                    fill="transparent"
                                    onMouseEnter={() => setHover(i)}
                                />
                                {h > 0 && (
                                    <rect
                                        x={i * slot} y={H - h} width={barW} height={h} rx={1.5}
                                        fill="var(--c-brand)"
                                        opacity={hover !== null && !isHover ? 0.4 : 1}
                                        style={{ transition: 'opacity 120ms' }}
                                        pointerEvents="none"
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {hover !== null && data[hover] && (
                    <div
                        className="tooltip top-1"
                        style={{
                            left: `${Math.min(Math.max((hover + 0.5) / data.length, 0.08), 0.92) * 100}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <span className="font-mono font-semibold tabular">{data[hover].total}</span>
                        {' '}{data[hover].total === 1 ? 'ride' : 'rides'}
                        <span className="text-fg-3"> &middot; {fmtDay(data[hover].date)}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-fg-3">
                <span>{fmtDay(data[0].date)}</span>
                <span>{fmtDay(data[data.length - 1].date)}</span>
            </div>
        </div>
    );
}
