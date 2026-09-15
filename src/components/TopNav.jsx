import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, AlertCircle, Menu, Sun, Moon, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTheme, applyTheme } from '../lib/theme';
import { PERIODS } from '../lib/periods';
import { ROLE_LABELS } from '../lib/roles';

export default function TopNav({ toggleSidebar, currentUser, profile, role, pendingDrivers = [], period, onPeriodChange }) {
    const [showNotifications, setShowNotifications] = useState(false);
    const [theme, setThemeState] = useState(getTheme);
    const notificationRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setThemeState(next);
    };

    return (
        <header className="relative z-20 flex items-center gap-3 px-4 border-b h-14 sm:px-6 bg-surface border-line shrink-0">
            <button
                onClick={toggleSidebar}
                aria-label="Open navigation"
                className="p-2 -ml-1 transition-colors rounded-md text-fg-3 hover:text-fg hover:bg-raised lg:hidden shrink-0"
            >
                <Menu className="w-4 h-4" />
            </button>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
                <Search className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-fg-3" />
                <input
                    id="global-search"
                    type="search"
                    placeholder="Search anything (rides, drivers, customers...)"
                    onKeyDown={(e) => {
                        const q = e.currentTarget.value.trim();
                        if (e.key === 'Enter' && q) navigate(`/rides?q=${encodeURIComponent(q)}`);
                    }}
                    className="w-full py-2 pl-9 pr-3 text-[13px] rounded-lg bg-raised text-fg border border-line
                               placeholder:text-fg-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
                {/* Period */}
                <div className="relative hidden sm:block">
                    <Calendar className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none left-2.5 top-1/2 text-fg-3" />
                    <select
                        id="period"
                        value={period}
                        onChange={(e) => onPeriodChange(Number(e.target.value))}
                        aria-label="Reporting period"
                        className="py-2 pl-8 pr-7 text-[13px] rounded-lg bg-surface text-fg border border-line
                                   focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none"
                    >
                        {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                    </select>
                    <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-fg-3" />
                </div>

                <button
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                    aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    className="p-2 transition-colors rounded-lg text-fg-3 hover:text-fg hover:bg-raised"
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                        aria-label={`${pendingDrivers.length} drivers pending approval`}
                        className="relative p-2 transition-colors rounded-lg text-fg-3 hover:text-fg hover:bg-raised"
                    >
                        <Bell className="w-4 h-4" />
                        {pendingDrivers.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1
                                             text-[9px] font-bold text-white rounded-full bg-danger">
                                {pendingDrivers.length}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-2 overflow-hidden border rounded-xl w-80 bg-surface border-line shadow-2xl">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-raised border-line">
                                <h3 className="text-[13px] font-semibold text-fg">Pending approval</h3>
                                {pendingDrivers.length > 0 && <span className="pill pill-warn">{pendingDrivers.length} new</span>}
                            </div>
                            <div className="overflow-y-auto max-h-80">
                                {pendingDrivers.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <Bell className="w-6 h-6 mx-auto mb-2 text-fg-3 opacity-40" />
                                        <p className="text-[13px] text-fg-3">Nothing waiting on you</p>
                                    </div>
                                ) : pendingDrivers.map((driver) => (
                                    <button
                                        key={driver.id}
                                        onClick={() => {
                                            setShowNotifications(false);
                                            navigate('/drivers', { state: { selectedDriverId: driver.id } });
                                        }}
                                        className="flex items-start w-full gap-2.5 px-4 py-2.5 text-left border-b border-line/60 last:border-b-0 hover:bg-raised transition-colors"
                                    >
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium truncate text-fg">
                                                {driver.name || driver.email || 'Unknown driver'}
                                            </p>
                                            <p className="text-xs truncate text-fg-3">Awaiting document review</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Account */}
                <div className="flex items-center gap-2 pl-2 ml-1 border-l border-line">
                    <div className="flex items-center justify-center w-8 h-8 text-[11px] font-bold rounded-full bg-brand-soft text-brand-strong shrink-0">
                        {currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : 'AD'}
                    </div>
                    <span className="hidden sm:block">
                        <span className="block text-[13px] font-medium leading-tight text-fg">
                            {profile?.name || currentUser?.email?.split('@')[0] || 'Admin'}
                        </span>
                        <span className="block font-mono text-[10px] leading-tight text-fg-3">
                            {ROLE_LABELS[role] || 'no role'}
                        </span>
                    </span>
                    <ChevronDown className="hidden w-3.5 h-3.5 text-fg-3 sm:inline" />
                </div>
            </div>
        </header>
    );
}
