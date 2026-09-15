import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useCountUp } from '../lib/useCountUp';

const TONES = {
    blue: 'bg-info-soft text-info',
    violet: 'bg-violet-soft text-violet',
    green: 'bg-ok-soft text-ok',
    red: 'bg-danger-soft text-danger',
    amber: 'bg-brand-soft text-brand-strong',
};

export default function KpiCard(props) {
    const { label, value, change, to, tone = 'blue', prefix = '', loading = false, periodLabel = '' } = props;
    const Icon = props.icon;
    const shown = useCountUp(typeof value === 'number' ? value : null);
    const up = typeof change === 'number' && change >= 0;

    const body = (
        <>
            <div className="flex items-center gap-2.5 mb-3 min-h-[36px]">
                <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${TONES[tone] || TONES.blue}`}>
                    <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-[12px] font-medium leading-tight text-fg-2 line-clamp-2">{label}</span>
            </div>

            {loading ? (
                <div className="w-20 h-7 mb-2 skeleton" />
            ) : (
                <p className="text-[24px] font-bold leading-none tracking-tight text-fg tabular">
                    {prefix}{shown.toLocaleString('en-IN')}
                </p>
            )}

            <div className="mt-2 h-[26px]">
                {!loading && typeof change === 'number' ? (
                    <>
                        <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${up ? 'text-ok' : 'text-danger'}`}>
                            {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(change)}%
                        </span>
                        <span className="block text-[10px] leading-tight text-fg-3">vs previous period</span>
                    </>
                ) : !loading ? (
                    // Point-in-time states (active rides, drivers online) have no
                    // history to compare against, so they get no trend rather than a fake one.
                    <span className="block text-[10px] leading-tight text-fg-3">
                        {periodLabel || 'live figure'}
                    </span>
                ) : null}
            </div>
        </>
    );

    const shell = 'flex flex-col p-4 border rounded-xl bg-surface border-line lift transition-all duration-150';
    return to
        ? <Link to={to} className={`${shell} hover:-translate-y-px hover:border-line-strong`}>{body}</Link>
        : <div className={shell}>{body}</div>;
}
