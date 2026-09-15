import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success('Login successful');
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            toast.error('Invalid credentials or access denied');
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
                    <h1 className="text-base font-semibold text-fg">Sign in</h1>
                    <p className="mt-1 mb-6 text-[13px] text-fg-3">
                        Authorised operations staff only.
                    </p>

                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="login-email" className="field-label">Email address</label>
                            <input
                                id="login-email"
                                type="email"
                                className="field"
                                placeholder="admin@firstcabs.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="field-label">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                className="field"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" disabled={loading} className="w-full mt-1 btn btn-primary">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Authenticating' : 'Sign in'}
                        </button>
                    </form>
                </div>

                <p className="mt-4 font-mono text-[10px] text-center text-fg-3">
                    firstcabs-5ef3e
                </p>
            </div>
        </div>
    );
}
