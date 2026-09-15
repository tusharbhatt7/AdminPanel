import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';

const TONES = {
    slate: { icon: 'bg-slate-100 text-slate-600', accent: 'text-slate-900', ring: 'hover:border-slate-300' },
    primary: { icon: 'bg-primary-50 text-primary-600', accent: 'text-primary-700', ring: 'hover:border-primary-300' },
    amber: { icon: 'bg-amber-50 text-amber-600', accent: 'text-amber-700', ring: 'hover:border-amber-300' },
    rose: { icon: 'bg-rose-50 text-rose-600', accent: 'text-rose-700', ring: 'hover:border-rose-300' },
    blue: { icon: 'bg-blue-50 text-blue-600', accent: 'text-blue-700', ring: 'hover:border-blue-300' },
    emerald: { icon: 'bg-emerald-50 text-emerald-600', accent: 'text-emerald-700', ring: 'hover:border-emerald-300' },
};

/**
 * A metric that is also a doorway: the whole card is the link to the filtered
 * list behind the number, so the count is never a dead end.
 */
export default function StatCard(props) {
    const {
        label, value, hint, to, tone = 'slate',
        loading = false, live = false, emphasis = false, warning = null,
    } = props;
    const Icon = props.icon;
    const t = TONES[tone] || TONES.slate;
    const unavailable = !loading && (value === null || value === undefined);

    return (
        <Link
            to={to}
            aria-label={`${label}: ${unavailable ? 'unavailable' : value}. View details.`}
            className={`group relative flex flex-col p-5 bg-white border rounded-2xl transition-all duration-200
                outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2
                hover:shadow-md hover:-translate-y-0.5 ${t.ring}
                ${emphasis ? 'border-primary-200 shadow-sm ring-1 ring-primary-100' : 'border-slate-200'}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${t.icon}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {live && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700">
                        <span className="relative flex w-1.5 h-1.5">
                            <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-emerald-500 animate-ping" />
                            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </span>
                        Live
                    </span>
                )}
            </div>

            <div className="text-sm font-medium text-slate-500">{label}</div>

            <div className="flex items-baseline gap-2 mt-1">
                {loading ? (
                    <div className="w-16 h-9 rounded-lg bg-slate-100 animate-pulse" />
                ) : unavailable ? (
                    <span className="text-2xl font-semibold text-slate-300" title="This metric could not be loaded">—</span>
                ) : (
                    <span className={`text-3xl font-bold tabular-nums ${t.accent}`}>
                        {value.toLocaleString('en-IN')}
                    </span>
                )}
            </div>

            {warning && !loading && (
                <div className="flex items-start gap-1.5 mt-2 text-xs font-medium text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                    <span>{warning}</span>
                </div>
            )}

            {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}

            <div className="flex items-center mt-4 pt-3 text-xs font-semibold border-t border-slate-100 text-slate-400 group-hover:text-primary-600 transition-colors">
                View details
                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
            </div>
        </Link>
    );
}
