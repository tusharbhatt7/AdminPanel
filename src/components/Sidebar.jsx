import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Car, ShieldAlert, BarChart3, Settings, MonitorPlay, X } from 'lucide-react';

const navItems = [
    { path: '/drivers', name: 'Driver Management', icon: Car },
    { path: '/customers', name: 'Customer Management', icon: Users },
    { path: '/safety', name: 'Safety & Compliance', icon: ShieldAlert },
    { path: '/analytics', name: 'Business & Analytics', icon: BarChart3 },
    { path: '/advertisements', name: 'Advertisements', icon: MonitorPlay },
    { path: '/settings', name: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen }) {
    return (
        <div
            className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 h-screen px-4 py-8 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
                } md:relative md:translate-x-0 md:shadow-none`}
        >
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center justify-center flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">
                        First<span className="text-primary-600">Cabs</span> Admin
                    </h1>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md md:hidden transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
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
                            onClick={() => {
                                // Close sidebar on mobile when a link is clicked
                                if (window.innerWidth < 768) {
                                    setIsOpen(false);
                                }
                            }}
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
