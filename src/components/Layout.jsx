import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

// Helper function to determine the title based on the path
const getTitleFromPath = (pathname) => {
    switch (pathname) {
        case '/drivers':
            return 'Driver Management';
        case '/customers':
            return 'Customer Management';
        case '/safety':
            return 'Safety & Compliance';
        case '/analytics':
            return 'Business & Analytics';
        case '/settings':
            return 'Settings';
        default:
            return 'Dashboard';
    }
};

export default function Layout() {
    const location = useLocation();
    const currentTitle = getTitleFromPath(location.pathname);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 relative">
            {/* Mobile Sidebar Overlay Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex flex-col flex-1 w-full overflow-hidden">
                <TopNav title={currentTitle} toggleSidebar={toggleSidebar} />
                <main className="flex-1 w-full p-4 sm:p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
