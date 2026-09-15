import React, { useState, useEffect, useCallback } from 'react';
import {
    Route, Navigation, Clock, XCircle,
    Users, UserPlus, Car, Wifi, CarFront, RefreshCw,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import {
    fetchDashboardStats, listenToActiveRides, listenToPendingRides,
    NEW_WINDOW_OPTIONS,
} from '../services/dashboardService';
import { STALE_ACTIVE_HOURS } from '../lib/rideStatus';

export default function Dashboard() {
    const [windowDays, setWindowDays] = useState(30);
    const [refreshKey, setRefreshKey] = useState(0);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Keeping the window the data was fetched for lets `loading` be derived rather
    // than tracked, so switching windows shows skeletons without an extra setState.
    const [statsState, setStatsState] = useState({ data: null, forWindow: null, forKey: -1 });
    const loading = statsState.data === null
        || statsState.forWindow !== windowDays
        || statsState.forKey !== refreshKey;

    const [active, setActive] = useState({ status: 'loading' });
    const [pending, setPending] = useState({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await fetchDashboardStats(windowDays);
            if (cancelled) return;
            setStatsState({ data, forWindow: windowDays, forKey: refreshKey });
            setLastUpdated(new Date());
        })();
        return () => { cancelled = true; };
    }, [windowDays, refreshKey]);

    useEffect(() => listenToActiveRides(
        (update) => setActive({ status: 'ok', ...update }),
        () => setActive({ status: 'error' }),
    ), []);

    useEffect(() => listenToPendingRides(
        (update) => setPending({ status: 'ok', ...update }),
        () => setPending({ status: 'error' }),
    ), []);

    const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    const s = statsState.data || {};
    const windowLabel = NEW_WINDOW_OPTIONS.find((o) => o.days === windowDays)?.label.toLowerCase() ?? '';
    const liveValue = (state) => (state.status === 'ok' ? state.count : state.status === 'error' ? null : undefined);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold tracking-tight text-fg">Overview</h2>
                    <p className="mt-0.5 text-[13px] text-fg-3">
                        Every tile opens the list behind its number.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="new-window" className="eyebrow whitespace-nowrap">New =</label>
                    <select
                        id="new-window"
                        value={windowDays}
                        onChange={(e) => setWindowDays(Number(e.target.value))}
                        className="field w-auto"
                    >
                        {NEW_WINDOW_OPTIONS.map((o) => (
                            <option key={o.days} value={o.days}>{o.label}</option>
                        ))}
                    </select>
                    <button onClick={handleRefresh} disabled={loading} className="btn btn-default">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Rides */}
            <section>
                <h3 className="mb-2.5 eyebrow">Rides</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Active Rides" value={liveValue(active)} icon={Navigation} tone="primary"
                        to="/rides?status=active" loading={active.status === 'loading'} live emphasis
                        hint="Driver assigned, ride under way"
                        warning={active.status === 'ok' && active.staleCount > 0
                            ? `${active.staleCount} stuck for over ${STALE_ACTIVE_HOURS}h`
                            : null}
                    />
                    <StatCard
                        label="Pending Rides" value={liveValue(pending)} icon={Clock} tone="amber"
                        to="/rides?status=pending" loading={pending.status === 'loading'} live
                        hint="Rider waiting for a driver to accept"
                    />
                    <StatCard
                        label="Total Rides" value={s.totalRides} icon={Route} tone="slate"
                        to="/rides" loading={loading} hint="Every ride request ever created"
                    />
                    <StatCard
                        label="Cancelled Rides" value={s.cancelledRides} icon={XCircle} tone="rose"
                        to="/rides?status=cancelled" loading={loading}
                        hint={typeof s.cancelledRides === 'number' && s.totalRides
                            ? `${Math.round((s.cancelledRides / s.totalRides) * 100)}% of all rides`
                            : 'Cancelled by rider, driver or dispatch'}
                    />
                </div>
            </section>

            {/* Customers */}
            <section>
                <h3 className="mb-2.5 eyebrow">Customers</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total Customers" value={s.totalCustomers} icon={Users} tone="blue"
                        to="/customers" loading={loading} hint="Registered rider accounts"
                    />
                    <StatCard
                        label="New Customers" value={s.newCustomers} icon={UserPlus} tone="emerald"
                        to={`/customers?preset=new&days=${windowDays}`} loading={loading}
                        hint={`Signed up in the ${windowLabel}`}
                    />
                </div>
            </section>

            {/* Drivers */}
            <section>
                <h3 className="mb-2.5 eyebrow">Drivers</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total Drivers" value={s.totalDrivers} icon={Car} tone="slate"
                        to="/drivers" loading={loading} hint="All registered driver accounts"
                    />
                    <StatCard
                        label="Active Drivers" value={s.activeDrivers} icon={Wifi} tone="emerald"
                        to="/drivers?preset=online" loading={loading} hint="Currently online and reachable"
                    />
                    <StatCard
                        label="New Drivers" value={s.newDrivers} icon={CarFront} tone="primary"
                        to={`/drivers?preset=new&days=${windowDays}`} loading={loading}
                        hint={`Joined in the ${windowLabel}`}
                    />
                </div>
            </section>

            {lastUpdated && (
                <p className="font-mono text-[10px] text-fg-3">
                    Counts updated {lastUpdated.toLocaleTimeString('en-IN')} &middot; active and pending rides stream live
                </p>
            )}
        </div>
    );
}
