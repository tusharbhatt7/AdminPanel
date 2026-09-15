import React from 'react';
import { Link } from 'react-router-dom';
import { Filter, X, ArrowLeft } from 'lucide-react';

/**
 * Shown when a page was opened from a dashboard card. Without it the list looks
 * like the full collection with rows mysteriously missing.
 */
export default function PresetBanner({ label, description, count, onClear }) {
    return (
        <div className="flex flex-col gap-3 px-3 py-2.5 border rounded-lg sm:flex-row sm:items-center sm:justify-between bg-brand-soft border-brand/30">
            <div className="flex items-start min-w-0 gap-2.5">
                <Filter className="w-4 h-4 mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg">
                        {label}
                        {typeof count === 'number' && (
                            <span className="ml-1.5 font-mono text-xs text-fg-2">{count}</span>
                        )}
                    </p>
                    {description && <p className="text-xs text-fg-2">{description}</p>}
                </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <Link to="/dashboard" className="btn btn-ghost btn-sm">
                    <ArrowLeft className="w-3.5 h-3.5" /> Overview
                </Link>
                <button onClick={onClear} className="btn btn-default btn-sm">
                    <X className="w-3.5 h-3.5" /> Clear
                </button>
            </div>
        </div>
    );
}
