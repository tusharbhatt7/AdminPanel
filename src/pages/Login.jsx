import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { login, requestPasswordReset, lockoutState, MAX_ATTEMPTS } from '../services/authService';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('signin');  // 'signin' | 'reset'
    const navigate = useNavigate();

    const lock = lockoutState(email);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(email, password);
            toast.success('Signed in');
            navigate('/dashboard');
        } catch (err) {
            // One message for a wrong email and a wrong password alike, so the
            // form cannot be used to discover which addresses are registered.
            setError(err.message);
            setPassword('');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await requestPasswordReset(email);
            toast.success('If that address has an account, a reset link is on its way');
            setMode('signin');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen px-4 bg-canvas">
            <div className="w-full max-w-sm">
                <div className="flex items-center gap-2.5 mb-6">
                    <span className="w-[3px] h-6 rounded-full bg-brand" />
                    <span className="text-lg font-semibold tracking-tight text-fg">
                        FirstCabs
                        <span className="ml-1.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase text-fg-3">
                            Admin
                        </span>
                    </span>
                </div>

                <div className="p-6 panel">
                    <h1 className="text-base font-semibold text-fg">
                        {mode === 'signin' ? 'Sign in' : 'Reset your password'}
                    </h1>
                    <p className="mt-1 mb-6 text-[13px] text-fg-3">
                        {mode === 'signin'
                            ? 'Authorised staff only. Every sign-in is recorded.'
                            : 'We will email you a link to choose a new password.'}
                    </p>

                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2.5 mb-4 text-[13px] border rounded-lg bg-danger-soft border-danger/30 text-fg-2">
                            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
                            <span>{error}</span>
                        </div>
                    )}

                    {mode === 'signin' && lock.remaining < MAX_ATTEMPTS && lock.remaining > 0 && (
                        <p className="mb-4 -mt-2 text-[12px] text-warn">
                            {lock.remaining} attempt{lock.remaining === 1 ? '' : 's'} left before this address is locked out.
                        </p>
                    )}

                    <form onSubmit={mode === 'signin' ? handleLogin : handleReset} className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="login-email" className="field-label">Email address</label>
                            <input
                                id="login-email" type="email" autoComplete="username" className="field"
                                placeholder="you@firstcabs.com" value={email}
                                onChange={(e) => setEmail(e.target.value)} required
                            />
                        </div>

                        {mode === 'signin' && (
                            <div>
                                <label htmlFor="login-password" className="field-label">Password</label>
                                <input
                                    id="login-password" type="password" autoComplete="current-password" className="field"
                                    placeholder="••••••••" value={password}
                                    onChange={(e) => setPassword(e.target.value)} required
                                />
                            </div>
                        )}

                        <button type="submit" disabled={loading || (mode === 'signin' && lock.locked)} className="w-full mt-1 btn btn-primary">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading
                                ? (mode === 'signin' ? 'Signing in' : 'Sending')
                                : (mode === 'signin' ? 'Sign in' : 'Send reset link')}
                        </button>
                    </form>

                    <div className="pt-4 mt-4 border-t border-line">
                        {mode === 'signin' ? (
                            <button onClick={() => { setMode('reset'); setError(null); }}
                                className="text-[12px] font-medium text-link hover:underline">
                                Forgot your password?
                            </button>
                        ) : (
                            <button onClick={() => { setMode('signin'); setError(null); }}
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-link hover:underline">
                                <ArrowLeft className="w-3 h-3" /> Back to sign in
                            </button>
                        )}
                    </div>
                </div>

                <p className="mt-4 font-mono text-[10px] text-center text-fg-3">firstcabs-5ef3e</p>
            </div>
        </div>
    );
}
