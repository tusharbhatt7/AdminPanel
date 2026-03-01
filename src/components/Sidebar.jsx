import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Car, ShieldAlert, BarChart3, Settings, MonitorPlay } from 'lucide-react';

const navItems = [
    { path: '/drivers', name: 'Driver Management', icon: Car },
    { path: '/customers', name: 'Customer Management', icon: Users },
    { path: '/safety', name: 'Safety & Compliance', icon: ShieldAlert },
    { path: '/analytics', name: 'Business & Analytics', icon: BarChart3 },
    { path: '/advertisements', name: 'Advertisements', icon: MonitorPlay },
    { path: '/settings', name: 'Settings', icon: Settings },
];

export default function Sidebar() {
    return (
        <div className="flex flex-col w-64 h-screen px-4 py-8 bg-white border-r border-slate-200">
            <div className="flex items-center justify-center mb-10">
                <h1 className="text-2xl font-bold text-slate-800">
                    First<span className="text-primary-600">Cabs</span> Admin
                </h1>
            </div>

            <div className="flex flex-col flex-1 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center px-4 py-3 transition-colors rounded-lg group ${isActive
                                    ? 'bg-primary-50 text-primary-700 font-semibold'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon
                                        className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
                                            }`}
                                    />
                                    {item.name}
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </div>

            <div className="pt-4 border-t border-slate-200">
                <div className="text-sm text-center text-slate-400">
                    v1.0.0 &copy; 2026 FirstCabs
                </div>
            </div>
        </div>
    );
}
