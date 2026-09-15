import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Bell, AlertCircle, ChevronRight, Menu, Sun, Moon } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { fetchDrivers } from '../services/driverService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTheme, applyTheme } from '../lib/theme';

export default function TopNav({ title, toggleSidebar }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [theme, setThemeState] = useState(getTheme);
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

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setThemeState(next);
    };

    return (
        <header className="relative z-20 flex items-center justify-between h-14 gap-3 px-3 border-b sm:px-5 bg-surface border-line shrink-0">
            <div className="flex items-center flex-1 min-w-0 gap-2">
                <button
                    onClick={toggleSidebar}
                    aria-label="Open navigation"
                    className="p-2 transition-colors rounded-md text-fg-3 hover:text-fg hover:bg-raised md:hidden shrink-0"
                >
                    <Menu className="w-4 h-4" />
                </button>
                <h1 className="text-[15px] font-semibold tracking-tight truncate text-fg">
                    {title || 'Dashboard'}
                </h1>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                {/* Theme */}
                <button
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                    aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    className="p-2 transition-colors rounded-md text-fg-3 hover:text-fg hover:bg-raised"
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={handleNotificationClick}
                        aria-label={`${pendingDrivers.length} drivers pending approval`}
                        className="relative p-2 transition-colors rounded-md text-fg-3 hover:text-fg hover:bg-raised"
                    >
                        <Bell className="w-4 h-4" />
                        {pendingDrivers.length > 0 && (
                            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[15px] h-[15px] px-1
                                             font-mono text-[9px] font-bold rounded-full bg-warn text-canvas">
                                {pendingDrivers.length}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-2 overflow-hidden origin-top-right border rounded-lg w-80 bg-surface border-line shadow-2xl">
                            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-raised border-line">
                                <h3 className="eyebrow">Pending approval</h3>
                                {pendingDrivers.length > 0 && (
                                    <span className="pill pill-warn">{pendingDrivers.length} new</span>
                                )}
                            </div>

                            <div className="overflow-y-auto max-h-80">
                                {pendingDrivers.length === 0 ? (
                                    <div className="flex flex-col items-center p-6 text-center">
                                        <Bell className="w-6 h-6 mb-2 text-fg-3 opacity-40" />
                                        <p className="text-[13px] text-fg-3">Nothing waiting on you</p>
                                    </div>
                                ) : (
                                    <div>
                                        {pendingDrivers.map((driver) => (
                                            <div
                                                key={driver.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowNotifications(false);
                                                    navigate('/drivers', { state: { selectedDriverId: driver.id } });
                                                }}
                                                className="flex items-start gap-2.5 px-3 py-2.5 border-b cursor-pointer border-line/60 last:border-b-0 hover:bg-raised transition-colors group"
                                            >
                                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium truncate text-fg">
                                                        {driver.name || driver.email || 'Unknown driver'}
                                                    </p>
                                                    <p className="text-xs truncate text-fg-3">Awaiting document review</p>
                                                </div>
                                                <ChevronRight className="self-center w-4 h-4 transition-colors text-fg-3 group-hover:text-brand" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pendingDrivers.length > 0 && (
                                <div className="p-2 border-t bg-raised border-line">
                                    <button onClick={viewDrivers} className="w-full btn btn-ghost btn-sm">
                                        Open Driver Management
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden w-px h-6 mx-1 sm:block bg-line" />

                {/* Account */}
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 overflow-hidden text-xs font-semibold border rounded-md bg-brand-soft text-brand border-line shrink-0">
                        {currentUser?.photoURL ? (
                            <img src={currentUser.photoURL} alt="" className="object-cover w-full h-full" />
                        ) : currentUser?.email ? (
                            currentUser.email.charAt(0).toUpperCase()
                        ) : (
                            <User className="w-4 h-4" />
                        )}
                    </div>
                    <div className="hidden lg:block">
                        <p className="text-[13px] font-medium leading-tight text-fg">
                            {currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : 'Admin'}
                        </p>
                        <p className="font-mono text-[10px] leading-tight truncate text-fg-3 max-w-[160px]">
                            {currentUser?.email || 'Super Admin'}
                        </p>
                    </div>

                    <button
                        onClick={handleLogout}
                        title="Log out"
                        aria-label="Log out"
                        className="p-2 transition-colors rounded-md text-fg-3 hover:text-danger hover:bg-danger-soft"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
