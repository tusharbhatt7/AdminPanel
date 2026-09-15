import React, { useState } from 'react';

// Ordered by outcome quality: best result first, worst last. This also keeps the
// green and red segments non-adjacent, which the palette validator requires —
// side by side they fall below the deuteranopia separation floor.
const SEGMENTS = [
    { key: 'completed', label: 'Completed', color: 'var(--c-series-completed)' },
    { key: 'active', label: 'Active', color: 'var(--c-series-active)' },
    { key: 'pending', label: 'Pending', color: 'var(--c-series-pending)' },
    { key: 'cancelled', label: 'Cancelled', color: 'var(--c-series-cancelled)' },
];

const GAP = 2; // surface gap between segments, in viewBox units

export default function OutcomeBar({ counts, total, loading = false }) {
    const [hover, setHover] = useState(null);

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                <div className="h-8 skeleton" />
                <div className="h-4 w-2/3 skeleton" />
            </div>
        );
    }

    const parts = SEGMENTS
        .map((s) => ({ ...s, value: counts[s.key] ?? 0 }))
        .filter((s) => s.value > 0);
    const sum = total || parts.reduce((a, p) => a + p.value, 0);
    if (!sum) return <p className="text-[13px] text-fg-3">No rides recorded yet.</p>;

    const W = 1000;
    const H = 34;
    const gaps = GAP * Math.max(0, parts.length - 1);
    const scale = (W - gaps) / sum;

    // Prefix sum rather than an accumulator: nothing is reassigned during render.
    // n is at most 4, so the quadratic slice costs nothing.
    const widths = parts.map((p) => Math.max(p.value * scale, 3));
    const rects = parts.map((p, i) => ({
        ...p,
        w: widths[i],
        x: widths.slice(0, i).reduce((a, b) => a + b, 0) + GAP * i,
        pct: (p.value / sum) * 100,
    }));

    return (
        <div className="relative flex flex-col gap-3">
            <svg
                viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
                preserveAspectRatio="none" role="img"
                aria-label={rects.map((r) => `${r.label} ${r.value}`).join(', ')}
                className="overflow-visible"
            >
                {rects.map((r) => (
                    <rect
                        key={r.key}
                        x={r.x} y={0} width={r.w} height={H} rx={4}
                        fill={r.color}
                        opacity={hover && hover.key !== r.key ? 0.35 : 1}
                        onMouseEnter={() => setHover(r)}
                        onMouseLeave={() => setHover(null)}
                        style={{ transition: 'opacity 140ms' }}
                    />
                ))}
            </svg>

            {hover && (
                <div className="tooltip left-0 top-0">
                    <span className="font-mono font-semibold">{hover.value.toLocaleString('en-IN')}</span>
                    {' '}{hover.label} &middot; {hover.pct.toFixed(1)}%
                </div>
            )}

            {/* Legend doubles as the value table: identity is never colour alone. */}
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {rects.map((r) => (
                    <li
                        key={r.key}
                        onMouseEnter={() => setHover(r)}
                        onMouseLeave={() => setHover(null)}
                        className="flex items-center gap-1.5 cursor-default"
                    >
                        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: r.color }} />
                        <span className="text-[11px] text-fg-2">{r.label}</span>
                        <span className="font-mono text-[11px] font-semibold text-fg tabular">
                            {r.value.toLocaleString('en-IN')}
                        </span>
                        <span className="font-mono text-[10px] text-fg-3 tabular">{r.pct.toFixed(0)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
