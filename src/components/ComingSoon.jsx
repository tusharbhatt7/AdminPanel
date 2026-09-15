import React from 'react';
import { Construction } from 'lucide-react';

export default function ComingSoon({ title, description }) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md p-8 text-center panel">
                <div className="flex items-center justify-center w-10 h-10 mx-auto mb-4 rounded-md bg-raised text-fg-3">
                    <Construction className="w-5 h-5" />
                </div>
                <h2 className="text-base font-semibold text-fg">{title}</h2>
                <p className="mt-2 mb-5 text-[13px] text-fg-2">
                    {description || 'This module is still being built.'}
                </p>
                <span className="pill pill-neutral">Not built yet</span>
            </div>
        </div>
    );
}
