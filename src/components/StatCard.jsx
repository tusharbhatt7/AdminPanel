import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useCountUp } from '../lib/useCountUp';

// Semantic tone, kept separate from the brand accent so status reads as status.
const TONES = {
    slate: { stripe: 'var(--c-line-strong)', icon: 'text-fg-3', value: 'text-fg' },
    primary: { stripe: 'var(--c-brand)', icon: 'text-brand', value: 'text-fg' },
    amber: { stripe: 'var(--c-warn)', icon: 'text-warn', value: 'text-fg' },
    rose: { stripe: 'var(--c-danger)', icon: 'text-danger', value: 'text-fg' },
    blue: { stripe: 'var(--c-info)', icon: 'text-info', value: 'text-fg' },
    emerald: { stripe: 'var(--c-ok)', icon: 'text-ok', value: 'text-fg' },
};

/**
 * A metric that is also a doorway: the whole tile is the link to the filtered
 * list behind the number, so the count is never a dead end.
 */
export default function StatCard(props) {
    const {
        label, value, hint, to, tone = 'slate',
        loading = false, live = false, emphasis = false, warning = null,
    } = props;
    const Icon = props.icon;
    const index = props.index ?? 0;
    const t = TONES[tone] || TONES.slate;
    const unavailable = !loading && (value === null || value === undefined);
    const shown = useCountUp(typeof value === 'number' ? value : null);

    return (
        <Link
            to={to}
            aria-label={`${label}: ${unavailable ? 'unavailable' : value}. View details.`}
            style={{ '--stripe-color': t.stripe, animationDelay: `${index * 35}ms` }}
            className={`stripe rise group flex flex-col gap-3 p-4 pl-5 rounded-lg bg-surface border
                transition-[background-color,box-shadow,transform] duration-200
                hover:bg-raised hover:-translate-y-px
                ${emphasis ? 'border-line-strong glow' : 'border-line lift'}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0 gap-2">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${t.icon}`} />
                    <span className="eyebrow truncate">{label}</span>
                </div>
                {live && (
                    <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-ok shrink-0">
                        <span className="relative flex w-1.5 h-1.5">
                            <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-ok animate-ping" />
                            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-ok" />
                        </span>
                        Live
                    </span>
                )}
            </div>

            <div className="flex items-baseline gap-2">
                {loading ? (
                    <div className="w-14 h-8 skeleton" />
                ) : unavailable ? (
                    <span className="font-mono text-2xl font-semibold text-fg-3" title="This metric could not be loaded">—</span>
                ) : (
                    <span className={`font-mono text-[30px] leading-none font-semibold tabular tracking-tight ${t.value}`}>
                        {shown.toLocaleString('en-IN')}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1">
                {warning && !loading && (
                    <span className="flex items-start gap-1.5 text-[11px] font-medium text-warn">
                        <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                        {warning}
                    </span>
                )}
                {hint && <span className="text-[11px] leading-snug text-fg-3">{hint}</span>}
            </div>

            <div className="flex items-center gap-1 pt-2 mt-auto font-mono text-[10px] font-semibold tracking-[0.08em] uppercase border-t border-line text-fg-3 group-hover:text-brand transition-colors">
                Open
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </div>
        </Link>
    );
}
