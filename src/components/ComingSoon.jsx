import React from 'react';

export default function ComingSoon({ title, description }) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
            <div className="p-8 bg-white border rounded-2xl border-slate-200 shadow-sm max-w-md w-full">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-primary-50 text-primary-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800">{title}</h2>
                <p className="mb-6 text-slate-500">
                    {description || "This module is currently under development. Please check back later!"}
                </p>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-blue-50 text-blue-700">
                    Coming Soon
                </span>
            </div>
        </div>
    );
}
