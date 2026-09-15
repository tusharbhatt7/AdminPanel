import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/useAuth';

/**
 * Hides a route from anyone whose role does not carry the permission. This is
 * presentation only — the matching rule in firestore.rules is what actually
 * stops the data being read, and that one runs on Google's servers.
 */
export default function RequirePermission({ permission, children }) {
    const { can, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-2 rounded-full border-line border-t-brand animate-spin" />
            </div>
        );
    }

    if (!can(permission)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-full max-w-md p-6 text-center border rounded-xl bg-surface border-line lift">
                    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-4 rounded-lg bg-danger-soft text-danger">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <h2 className="text-[16px] font-semibold text-fg">You do not have access to this</h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-fg-2">
                        This area needs the <span className="font-mono text-[12px] text-fg">{permission}</span> permission,
                        which your role does not include. Ask a superuser if you need it.
                    </p>
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-link hover:underline">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return children;
}
