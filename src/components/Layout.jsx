import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

// Helper function to determine the title based on the path
const getTitleFromPath = (pathname) => {
    switch (pathname) {
        case '/dashboard':
            return 'Dashboard';
        case '/rides':
            return 'Ride Management';
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
        case '/advertisements':
            return 'Advertisements';
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
        <div className="relative flex h-screen overflow-hidden bg-canvas">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-canvas/80 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex flex-col flex-1 w-full overflow-hidden">
                <TopNav title={currentTitle} toggleSidebar={toggleSidebar} />
                <main className="flex-1 w-full p-4 overflow-y-auto sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
