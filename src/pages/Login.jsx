import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

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
            navigate('/drivers');
        } catch (error) {
            console.error(error);
            toast.error('Invalid credentials or access denied');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
            <div className="w-full max-w-md p-8 bg-white border outline-none rounded-2xl border-slate-200 shadow-xl text-center">

                <div className="flex items-center justify-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                        First<span className="text-primary-600">Cabs</span> Admin
                    </h1>
                </div>

                <h2 className="text-xl font-semibold text-slate-900 mb-6 text-left">Sign in to your account</h2>

                <form onSubmit={handleLogin} className="space-y-5 text-left">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            className="block w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-slate-50 text-slate-900"
                            placeholder="admin@firstcabs.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            className="block w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-slate-50 text-slate-900"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-6 w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:bg-primary-400"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-sm text-slate-500">
                    Secure admin dashboard access only.
                </p>
            </div>
        </div>
    );
}
