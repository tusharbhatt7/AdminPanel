import React from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import {
    LayoutDashboard, Route as RouteIcon, Car, Users, CreditCard, MessageSquareWarning,
    Star, BarChart3, TicketPercent, MonitorPlay, Truck, MapPin, Bell, Settings, LogOut, X,
} from 'lucide-react';

const navItems = [
    { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/rides', name: 'Rides', icon: RouteIcon },
    { path: '/drivers', name: 'Drivers', icon: Car },
    { path: '/customers', name: 'Customers', icon: Users },
    { path: '/payments', name: 'Payments', icon: CreditCard },
    { path: '/complaints', name: 'Complaints', icon: MessageSquareWarning },
    { path: '/reviews', name: 'Reviews', icon: Star },
    { path: '/analytics', name: 'Analytics', icon: BarChart3 },
    { path: '/promotions', name: 'Promotions', icon: TicketPercent },
    { path: '/advertisements', name: 'Advertisements', icon: MonitorPlay },
    { path: '/fleet', name: 'Fleet Management', icon: Truck },
    { path: '/zones', name: 'Cities & Zones', icon: MapPin },
    { path: '/notifications', name: 'Notifications', icon: Bell },
    { path: '/settings', name: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen, currentUser }) {
    const closeOnMobile = () => {
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast.success('Logged out successfully');
        } catch (error) {
            toast.error('Failed to log out');
            console.error(error);
        }
    };

    return (
        <aside
            style={{ background: 'var(--c-nav)' }}
            className={`fixed inset-y-0 left-0 z-40 flex flex-col w-[210px] h-screen
                transform transition-transform duration-200 ease-out
                ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                lg:relative lg:translate-x-0 lg:shadow-none`}
        >
            {/* Brand */}
            <div className="flex items-start justify-between gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--c-nav-line)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <Car className="w-7 h-7 shrink-0" style={{ color: 'var(--c-brand)' }} />
                    <div className="min-w-0">
                        <p className="text-[17px] font-bold leading-none tracking-tight" style={{ color: 'var(--c-brand)' }}>
                            FirstCabs
                        </p>
                        <p className="mt-1 text-[10px] leading-none" style={{ color: 'var(--c-nav-fg-3)' }}>
                            Ride. Anytime. Anywhere.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close navigation"
                    className="p-1 rounded-md lg:hidden"
                    style={{ color: 'var(--c-nav-fg-3)' }}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex flex-col flex-1 gap-0.5 px-2 py-3 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={closeOnMobile}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-100"
                            style={({ isActive }) => ({
                                background: isActive ? 'var(--c-brand)' : 'transparent',
                                color: isActive ? 'var(--c-brand-fg)' : 'var(--c-nav-fg)',
                            })}
                        >
                            <Icon className="w-[18px] h-[18px] shrink-0" />
                            <span className="truncate">{item.name}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Account */}
            <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--c-nav-line)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                    <div
                        className="flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full shrink-0"
                        style={{ background: 'var(--c-nav-2)', color: 'var(--c-brand)' }}
                    >
                        {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--c-nav-fg)' }}>
                            {currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : 'Admin'}
                        </p>
                        <p className="text-[10px] leading-tight" style={{ color: 'var(--c-nav-fg-3)' }}>Super Admin</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
                    style={{ color: 'var(--c-nav-fg)' }}
                >
                    <LogOut className="w-[18px] h-[18px] shrink-0" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
