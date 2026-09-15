import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

const TONE = {
    danger: { icon: AlertCircle, cls: 'text-danger' },
    warn: { icon: AlertTriangle, cls: 'text-warn' },
    info: { icon: Info, cls: 'text-info' },
};

export default function ActionRequired({ actions, loading = false }) {
    return (
        <div className="flex flex-col p-4 border rounded-xl bg-surface border-line lift">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-fg">Action Required</h3>
                <Link to="/drivers" className="text-[12px] font-medium text-link hover:underline">View All</Link>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2.5">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 skeleton" />)}
                </div>
            ) : actions.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-[13px] text-fg-3">
                    <CheckCircle2 className="w-4 h-4 text-ok" />
                    Nothing needs your attention right now.
                </div>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {actions.map((a) => {
                        const t = TONE[a.tone] || TONE.info;
                        const Icon = t.icon;
                        return (
                            <li key={a.key}>
                                <Link to={a.to} className="flex items-start gap-2.5 group">
                                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.cls}`} />
                                    <span className="text-[13px] leading-snug text-fg-2 group-hover:text-fg transition-colors">
                                        <span className="font-semibold text-fg tabular">{a.count}</span> {a.label}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
