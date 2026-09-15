import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Route as RouteIcon, Users, Car, ShieldAlert,
    BarChart3, Settings, MonitorPlay, X,
} from 'lucide-react';

// Grouping separates what an operator acts on minute to minute from what an
// admin configures occasionally — the two are used at completely different rates.
const navGroups = [
    {
        label: 'Operations',
        items: [
            { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { path: '/rides', name: 'Rides', icon: RouteIcon },
            { path: '/drivers', name: 'Drivers', icon: Car },
            { path: '/customers', name: 'Customers', icon: Users },
        ],
    },
    {
        label: 'Platform',
        items: [
            { path: '/advertisements', name: 'Advertisements', icon: MonitorPlay },
            { path: '/safety', name: 'Safety & Compliance', icon: ShieldAlert },
            { path: '/analytics', name: 'Business & Analytics', icon: BarChart3 },
            { path: '/settings', name: 'Settings', icon: Settings },
        ],
    },
];

export default function Sidebar({ isOpen, setIsOpen }) {
    const closeOnMobile = () => {
        if (window.innerWidth < 768) setIsOpen(false);
    };

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 flex flex-col w-60 h-screen bg-surface border-r border-line
                transform transition-transform duration-200 ease-out
                ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                md:relative md:translate-x-0 md:shadow-none`}
        >
            {/* Brand */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-line shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-[3px] h-5 rounded-full bg-brand shrink-0" />
                    <span className="text-[15px] font-semibold tracking-tight truncate text-fg">
                        FirstCabs
                        <span className="ml-1.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase text-fg-3">
                            Admin
                        </span>
                    </span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close navigation"
                    className="p-1.5 rounded-md text-fg-3 hover:text-fg hover:bg-raised md:hidden transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
                {navGroups.map((group) => (
                    <div key={group.label} className="mb-5 last:mb-0">
                        <p className="px-2 mb-1.5 eyebrow">{group.label}</p>
                        <div className="flex flex-col gap-0.5">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={closeOnMobile}
                                        className={({ isActive }) =>
                                            `relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-md text-[13px]
                                             transition-colors duration-100 ${isActive
                                                ? 'bg-raised text-fg font-medium'
                                                : 'text-fg-2 hover:text-fg hover:bg-raised/60'}`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                {isActive && (
                                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand" />
                                                )}
                                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand' : 'text-fg-3'}`} />
                                                <span className="truncate">{item.name}</span>
                                            </>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="px-4 py-3 border-t border-line shrink-0">
                <p className="font-mono text-[10px] text-fg-3">v1.0.0 &middot; &copy; 2026 FirstCabs</p>
            </div>
        </aside>
    );
}
