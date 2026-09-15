import React from 'react';
import { Link } from 'react-router-dom';
import { Database, ArrowLeft } from 'lucide-react';

/**
 * A module whose Firestore collection does not exist yet. It says exactly what
 * is missing and what would have to be written, rather than showing zeroes that
 * would read as real measurements.
 */
export default function EmptyModule({ title, collection, description, needs = [] }) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-lg p-6 border rounded-xl bg-surface border-line lift">
                <div className="flex items-center justify-center w-10 h-10 mb-4 rounded-lg bg-raised text-fg-3">
                    <Database className="w-5 h-5" />
                </div>

                <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{description}</p>

                <div className="p-3 mt-4 rounded-lg bg-raised">
                    <p className="text-[11px] text-fg-3">
                        Backing collection
                        <span className="ml-2 font-mono text-[11px] text-fg">{collection}</span>
                        <span className="ml-2 pill pill-neutral">does not exist</span>
                    </p>
                </div>

                {needs.length > 0 && (
                    <div className="mt-4">
                        <p className="mb-2 eyebrow">To switch this on</p>
                        <ul className="flex flex-col gap-1.5">
                            {needs.map((n) => (
                                <li key={n} className="flex gap-2 text-[13px] text-fg-2">
                                    <span className="text-fg-3">&middot;</span>{n}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <Link to="/dashboard" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-link hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
                </Link>
            </div>
        </div>
    );
}
