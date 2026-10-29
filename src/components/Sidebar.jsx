import React from 'react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    LayoutDashboard, Route as RouteIcon, Car, Users, CreditCard, MessageSquareWarning,
    Star, BarChart3, TicketPercent, MonitorPlay, Truck, MapPin, Bell, Settings, LogOut, X,
    UserCog, ScrollText, Radio, Wallet,
} from 'lucide-react';
import { logout } from '../services/authService';
import { PERMISSIONS, ROLE_LABELS } from '../lib/roles';

// Grouped, because seventeen flat items is a list to read rather than a place
// to navigate. `badge` names a worklist counter; a group only renders if the
// role can see something inside it.
//
// The five unbuilt modules sit in their own group at the bottom rather than
// among the working screens. They are real placeholders for collections that
// have never been created, and interleaving them taught people that half the
// navigation does nothing.
const NAV_GROUPS = [
    {
        title: 'Operations',
        items: [
            { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { path: '/live', name: 'Active Rides', icon: Radio, permission: PERMISSIONS.RIDES_READ, badge: 'activeRides' },
            { path: '/rides', name: 'All Rides', icon: RouteIcon },
            { path: '/drivers', name: 'Drivers', icon: Car, badge: 'pendingDrivers', badgeTone: 'warn' },
            { path: '/customers', name: 'Customers', icon: Users },
            { path: '/reviews', name: 'Reviews', icon: Star },
        ],
    },
    {
        title: 'Money',
        items: [
            { path: '/payments', name: 'Payments', icon: CreditCard },
            { path: '/wallets', name: 'Driver Wallets', icon: Wallet, permission: PERMISSIONS.WALLETS_READ, badge: 'pendingWithdrawals', badgeTone: 'warn' },
            { path: '/analytics', name: 'Analytics', icon: BarChart3 },
        ],
    },
    {
        title: 'Administration',
        items: [
            { path: '/advertisements', name: 'Advertisements', icon: MonitorPlay },
            { path: '/settings', name: 'Settings', icon: Settings },
            { path: '/users', name: 'Users & Roles', icon: UserCog, permission: PERMISSIONS.USERS_READ },
            { path: '/audit', name: 'Audit Log', icon: ScrollText, permission: PERMISSIONS.AUDIT_READ },
        ],
    },
    {
        title: 'Not built yet',
        muted: true,
        items: [
            { path: '/complaints', name: 'Complaints', icon: MessageSquareWarning },
            { path: '/promotions', name: 'Promotions', icon: TicketPercent },
            { path: '/fleet', name: 'Fleet', icon: Truck },
            { path: '/zones', name: 'Cities & Zones', icon: MapPin },
            { path: '/notifications', name: 'Notifications', icon: Bell },
        ],
    },
];

export default function Sidebar({ isOpen, setIsOpen, currentUser, profile, role, can, actor, worklist = {} }) {
    const closeOnMobile = () => {
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const handleLogout = async () => {
        try {
            await logout(actor);
            toast.success('Logged out successfully');
        } catch (error) {
            toast.error('Failed to log out');
            console.error(error);
        }
    };

    // Hiding a link is courtesy, not security — the route guard and the
    // Firestore rules are what actually refuse the access.
    const visibleGroups = NAV_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.permission || (can ? can(item.permission) : false)),
        }))
        .filter((group) => group.items.length > 0);

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
            <nav className="flex flex-col flex-1 gap-3 px-2 py-3 overflow-y-auto">
                {visibleGroups.map((group) => (
                    <div key={group.title} className="flex flex-col gap-0.5">
                        <p
                            className="px-3 pb-1 font-mono text-[9px] font-semibold tracking-[0.14em] uppercase"
                            style={{ color: 'var(--c-nav-fg-3)', opacity: group.muted ? 0.55 : 1 }}
                        >
                            {group.title}
                        </p>
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const count = item.badge ? worklist[item.badge] : null;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={closeOnMobile}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-100"
                                    style={({ isActive }) => ({
                                        background: isActive ? 'var(--c-brand)' : 'transparent',
                                        color: isActive ? 'var(--c-brand-fg)' : 'var(--c-nav-fg)',
                                        opacity: group.muted ? 0.55 : 1,
                                    })}
                                >
                                    <Icon className="w-[18px] h-[18px] shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                    {/* Zero is not shown: an empty queue should
                                        read as nothing to do, not as a count. */}
                                    {typeof count === 'number' && count > 0 && (
                                        <span
                                            className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular shrink-0"
                                            style={{
                                                background: item.badgeTone === 'warn' ? 'var(--c-warn)' : 'var(--c-info)',
                                                color: 'var(--c-nav)',
                                            }}
                                        >
                                            {count > 99 ? '99+' : count}
                                        </span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Account */}
            <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--c-nav-line)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                    <div
                        className="flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full shrink-0"
                        style={{ background: 'var(--c-nav-2)', color: 'var(--c-brand)' }}
                    >
                        {(profile?.name || currentUser?.email || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--c-nav-fg)' }}>
                            {profile?.name || currentUser?.email?.split('@')[0] || 'Admin'}
                        </p>
                        <p className="text-[10px] leading-tight" style={{ color: 'var(--c-nav-fg-3)' }}>
                            {ROLE_LABELS[role] || 'No role'}
                        </p>
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
