import React from 'react';
import { Link } from 'react-router-dom';

const TONE = {
    default: 'text-fg',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
    info: 'text-info',
};

/**
 * A row of related figures that only make sense together — driver states, or
 * customer cohorts. A figure with no backing field renders as an em dash with a
 * reason, never as a zero, which would read as a real measurement.
 */
export default function BreakdownPanel({ title, viewAllTo, items, loading = false }) {
    return (
        <div className="flex flex-col p-4 border rounded-xl bg-surface border-line lift">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
                {viewAllTo && (
                    <Link to={viewAllTo} className="text-[12px] font-medium text-link hover:underline">
                        View All
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
                {items.map((item) => (
                    <div key={item.label} className="min-w-0">
                        {loading ? (
                            <div className="w-12 h-6 mb-1 skeleton" />
                        ) : item.value === null || item.value === undefined ? (
                            <p className="text-[20px] font-bold leading-none text-fg-3" title={item.unavailable || 'Not recorded'}>
                                —
                            </p>
                        ) : (
                            <p className={`text-[20px] font-bold leading-none tabular ${TONE[item.tone] || TONE.default}`}>
                                {item.value.toLocaleString('en-IN')}
                            </p>
                        )}
                        <p className="mt-1.5 text-[11px] leading-tight text-fg-3">{item.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
