import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { listenToPendingDrivers } from '../services/driverService';
import { listenToWorklist } from '../services/worklistService';
import CommandPalette from './CommandPalette';
import { useAuth } from '../lib/useAuth';

export default function Layout() {
    const { user: currentUser, profile, role, can, actor } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [period, setPeriod] = useState(30);
    const [worklist, setWorklist] = useState({});

    // Live, so an approval anywhere in the panel clears the badge immediately.
    useEffect(() => listenToPendingDrivers(setPendingDrivers), []);

    // Each counter arrives on its own, so the patch is merged rather than
    // replaced — otherwise the last listener to fire would wipe the others.
    useEffect(() => listenToWorklist((patch) => setWorklist((prev) => ({ ...prev, ...patch }))), []);

    return (
        <div className="relative flex h-screen overflow-hidden bg-canvas">
            <CommandPalette />
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-fg/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} currentUser={currentUser} profile={profile} role={role} can={can} actor={actor} worklist={worklist} />

            <div className="flex flex-col flex-1 w-full overflow-hidden">
                <TopNav
                    toggleSidebar={() => setIsSidebarOpen((v) => !v)}
                    currentUser={currentUser}
                    profile={profile}
                    role={role}
                    pendingDrivers={pendingDrivers}
                    period={period}
                    onPeriodChange={setPeriod}
                />
                <main className="flex-1 w-full p-4 overflow-y-auto sm:p-5">
                    <Outlet context={{ period, currentUser, profile, role, actor, pendingDrivers }} />
                </main>
            </div>
        </div>
    );
}
