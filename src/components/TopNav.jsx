import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Bell, AlertCircle, ChevronRight } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { fetchDrivers } from '../services/driverService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function TopNav({ title }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadPendingDrivers = async () => {
            try {
                const drivers = await fetchDrivers();
                const unapproved = drivers.filter(d => !d.isApproved);
                setPendingDrivers(unapproved);
            } catch (error) {
                console.error("Failed to load notifications", error);
            }
        };
        loadPendingDrivers();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast.success('Logged out successfully');
        } catch (error) {
            toast.error('Failed to log out');
            console.error(error);
        }
    };

    const handleNotificationClick = (e) => {
        e.stopPropagation();
        setShowNotifications(!showNotifications);
    };

    const viewDrivers = () => {
        setShowNotifications(false);
        navigate('/drivers');
    };

    return (
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 h-[72px] relative z-20">
            <div>
                <h2 className="text-2xl font-semibold text-slate-800">{title || 'Dashboard'}</h2>
            </div>

            <div className="flex items-center space-x-6">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={handleNotificationClick}
                        className="relative p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all duration-200"
                    >
                        <Bell className="w-5 h-5" />
                        {pendingDrivers.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                                {pendingDrivers.length}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                                {pendingDrivers.length > 0 && (
                                    <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pendingDrivers.length} New
                                    </span>
                                )}
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {pendingDrivers.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                                        <Bell className="w-8 h-8 text-slate-300 mb-2 opacity-50" />
                                        <p className="text-sm">No new notifications</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {pendingDrivers.map((driver) => (
                                            <div
                                                key={driver.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowNotifications(false);
                                                    navigate('/drivers', { state: { selectedDriverId: driver.id } });
                                                }}
                                                className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-start space-x-3 group"
                                            >
                                                <div className="mt-0.5 bg-amber-100 p-1.5 rounded-full text-amber-600 shrink-0">
                                                    <AlertCircle className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">New Driver Registration</p>
                                                    <p className="text-xs text-slate-500 mt-1 truncate">{driver.name || driver.email || 'Unknown User'} is pending approval.</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors self-center" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pendingDrivers.length > 0 && (
                                <div className="p-3 border-t border-slate-100 bg-slate-50">
                                    <button
                                        onClick={viewDrivers}
                                        className="w-full py-2 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                    >
                                        View All in Driver Management
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-200"></div>

                <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-primary-700 border border-primary-200 shadow-sm shadow-primary-500/10">
                        {currentUser?.photoURL ? (
                            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <span className="font-bold text-lg">
                                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                            </span>
                        )}
                    </div>
                    <div className="hidden md:block">
                        <p className="text-sm font-bold text-slate-800 tracking-tight">
                            {currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : 'Admin User'}
                        </p>
                        <p className="text-xs font-medium text-slate-500 truncate max-w-[150px]">
                            {currentUser?.email || 'Super Admin'}
                        </p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2 ml-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors active:scale-95"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}
