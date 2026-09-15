import React from 'react';
import { Link } from 'react-router-dom';
import { Filter, X, ArrowLeft } from 'lucide-react';

/**
 * Shown when a page was opened from a dashboard card. Without it the list looks
 * like the full collection with rows mysteriously missing.
 */
export default function PresetBanner({ label, description, count, onClear }) {
    return (
        <div className="flex flex-col gap-3 p-3 border sm:flex-row sm:items-center sm:justify-between rounded-xl bg-primary-50 border-primary-200">
            <div className="flex items-start gap-2.5 min-w-0">
                <Filter className="w-4 h-4 mt-0.5 shrink-0 text-primary-600" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-800">
                        Filtered: {label}
                        {typeof count === 'number' && (
                            <span className="ml-1.5 font-normal text-primary-600">({count})</span>
                        )}
                    </p>
                    {description && <p className="text-xs text-primary-700/80">{description}</p>}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors rounded-lg text-primary-700 hover:bg-primary-100"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Overview
                </Link>
                <button
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border rounded-lg border-primary-200 text-primary-700 hover:bg-primary-100 transition-colors"
                >
                    <X className="w-3.5 h-3.5" /> Clear filter
                </button>
            </div>
        </div>
    );
}
