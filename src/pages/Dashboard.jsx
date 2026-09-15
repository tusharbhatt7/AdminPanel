import React, { useState, useEffect, useCallback } from 'react';
import {
    Route, Navigation, Clock, XCircle,
    Users, UserPlus, Car, Wifi, CarFront, RefreshCw,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import OutcomeBar from '../components/OutcomeBar';
import VolumeChart from '../components/VolumeChart';
import {
    fetchDashboardStats, fetchRideVolume, listenToActiveRides, listenToPendingRides,
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

    // Fetched separately from the counts: it reads one document per ride in the
    // window, so it must never hold up the tiles.
    const [volume, setVolume] = useState(null);

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

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await fetchRideVolume(90);
                if (!cancelled) setVolume(rows);
            } catch (error) {
                console.error('Ride volume failed:', error);
                if (!cancelled) setVolume([]);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshKey]);

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
    const cancelRate = typeof s.cancelledRides === 'number' && s.totalRides
        ? Math.round((s.cancelledRides / s.totalRides) * 100)
        : null;
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
                        label="Active Rides" index={0} value={liveValue(active)} icon={Navigation} tone="primary"
                        to="/rides?status=active" loading={active.status === 'loading'} live emphasis
                        hint="Driver assigned, ride under way"
                        warning={active.status === 'ok' && active.staleCount > 0
                            ? `${active.staleCount} stuck for over ${STALE_ACTIVE_HOURS}h`
                            : null}
                    />
                    <StatCard
                        label="Pending Rides" index={1} value={liveValue(pending)} icon={Clock} tone="amber"
                        to="/rides?status=pending" loading={pending.status === 'loading'} live
                        hint="Rider waiting for a driver to accept"
                    />
                    <StatCard
                        label="Total Rides" index={2} value={s.totalRides} icon={Route} tone="slate"
                        to="/rides" loading={loading} hint="Every ride request ever created"
                    />
                    <StatCard
                        label="Cancelled Rides" index={3} value={s.cancelledRides} icon={XCircle} tone="rose"
                        to="/rides?status=cancelled" loading={loading}
                        hint={typeof s.cancelledRides === 'number' && s.totalRides
                            ? `${Math.round((s.cancelledRides / s.totalRides) * 100)}% of all rides`
                            : 'Cancelled by rider, driver or dispatch'}
                    />
                </div>
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 gap-3 rise lg:grid-cols-3" style={{ animationDelay: '140ms' }}>
                <div className="flex flex-col gap-3 p-4 border rounded-lg lg:col-span-2 bg-surface border-line lift">
                    <div>
                        <h3 className="eyebrow">Ride volume &middot; last 90 days</h3>
                        <p className="mt-1 text-[11px] text-fg-3">
                            Bars, not a line — activity is bursty and most days are genuinely empty.
                        </p>
                    </div>
                    <VolumeChart data={volume} loading={volume === null} />
                </div>

                <div className="flex flex-col gap-4 p-4 border rounded-lg bg-surface border-line lift">
                    <div>
                        <h3 className="eyebrow">Outcome mix</h3>
                        <p className="mt-1 text-[11px] text-fg-3">
                            Every ride ever created, by how it ended.
                        </p>
                    </div>

                    {/* The dominant fact in this dataset deserves to be read first. */}
                    <div className="flex items-baseline gap-2">
                        {loading ? (
                            <div className="w-24 h-10 skeleton" />
                        ) : (
                            <>
                                <span className="font-mono text-[34px] leading-none font-semibold tracking-tight text-fg tabular">
                                    {cancelRate === null ? '—' : `${cancelRate}%`}
                                </span>
                                <span className="text-[12px] leading-tight text-fg-2">
                                    of all rides<br />were cancelled
                                </span>
                            </>
                        )}
                    </div>

                    <OutcomeBar
                        loading={loading}
                        total={s.totalRides}
                        counts={{
                            completed: s.completedRides,
                            active: active.status === 'ok' ? active.count : 0,
                            pending: pending.status === 'ok' ? pending.count : 0,
                            cancelled: s.cancelledRides,
                        }}
                    />
                </div>
            </section>

            {/* Customers */}
            <section>
                <h3 className="mb-2.5 eyebrow">Customers</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total Customers" index={4} value={s.totalCustomers} icon={Users} tone="blue"
                        to="/customers" loading={loading} hint="Registered rider accounts"
                    />
                    <StatCard
                        label="New Customers" index={5} value={s.newCustomers} icon={UserPlus} tone="emerald"
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
                        label="Total Drivers" index={6} value={s.totalDrivers} icon={Car} tone="slate"
                        to="/drivers" loading={loading} hint="All registered driver accounts"
                    />
                    <StatCard
                        label="Active Drivers" index={7} value={s.activeDrivers} icon={Wifi} tone="emerald"
                        to="/drivers?preset=online" loading={loading} hint="Currently online and reachable"
                    />
                    <StatCard
                        label="New Drivers" index={8} value={s.newDrivers} icon={CarFront} tone="primary"
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
