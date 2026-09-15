import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Car, Navigation, CheckCircle2, XCircle, Users, IdCard, Wifi, IndianRupee, RefreshCw,
} from 'lucide-react';
import KpiCard from '../components/KpiCard';
import RidesOverviewChart from '../components/RidesOverviewChart';
import RevenuePanel from '../components/RevenuePanel';
import LiveRidesPanel from '../components/LiveRidesPanel';
import BreakdownPanel from '../components/BreakdownPanel';
import ActionRequired from '../components/ActionRequired';
import RecentTable from '../components/RecentTable';
import { fetchOverview, fetchLiveRides } from '../services/overviewService';
import { periodLabel } from '../lib/periods';
import { statusStyle, statusLabel, formatCurrency, formatAge } from '../lib/rideStatus';
import { looksEncrypted } from '../lib/pii';

const money = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export default function Dashboard() {
    const { period, currentUser } = useOutletContext();
    const [refreshKey, setRefreshKey] = useState(0);
    const [model, setModel] = useState(null);
    const [live, setLive] = useState(null);
    const [forPeriod, setForPeriod] = useState(null);

    const loading = model === null || forPeriod !== period;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchOverview(period);
                if (cancelled) return;
                setModel(data);
                setForPeriod(period);
            } catch (error) {
                console.error('Overview failed:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [period, refreshKey]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const rides = await fetchLiveRides(6);
            if (!cancelled) setLive(rides);
        })();
        return () => { cancelled = true; };
    }, [refreshKey]);

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    const k = model?.kpis ?? {};
    const now = new Date();
    const greetingName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

    return (
        <div className="flex flex-col gap-4">
            {/* Welcome */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-bold tracking-tight text-fg">
                        Welcome back, {greetingName}!
                    </h1>
                    <p className="mt-0.5 text-[13px] text-fg-2">
                        Here&rsquo;s what&rsquo;s happening with FirstCabs today.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <p className="text-[12px] text-fg-3 tabular">
                        {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="mx-1.5 text-fg-3">|</span>
                        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button onClick={refresh} disabled={loading} aria-label="Refresh"
                        className="p-2 transition-colors border rounded-lg text-fg-3 border-line hover:text-fg hover:bg-raised disabled:opacity-50">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard label="Total Rides" icon={Car} tone="blue" to="/rides" loading={loading}
                    value={k.totalRides?.value} change={k.totalRides?.change} periodLabel={periodLabel(period)} />
                <KpiCard label="Active Rides" icon={Navigation} tone="violet" to="/rides?status=active" loading={loading}
                    value={k.activeRides?.value} change={k.activeRides?.change} periodLabel="in flight now" />
                <KpiCard label="Completed Rides" icon={CheckCircle2} tone="green" to="/rides?status=completed" loading={loading}
                    value={k.completedRides?.value} change={k.completedRides?.change} />
                <KpiCard label="Cancelled Rides" icon={XCircle} tone="red" to="/rides?status=cancelled" loading={loading}
                    value={k.cancelledRides?.value} change={k.cancelledRides?.change} />
                <KpiCard label="Total Customers" icon={Users} tone="blue" to="/customers" loading={loading}
                    value={k.totalCustomers?.value} change={k.totalCustomers?.change} />
                <KpiCard label="Total Drivers" icon={IdCard} tone="green" to="/drivers" loading={loading}
                    value={k.totalDrivers?.value} change={k.totalDrivers?.change} />
                <KpiCard label="Online Drivers" icon={Wifi} tone="green" to="/drivers?preset=online" loading={loading}
                    value={k.onlineDrivers?.value} change={k.onlineDrivers?.change} periodLabel="online now" />
                <KpiCard label="Ride Revenue" icon={IndianRupee} tone="amber" loading={loading}
                    value={k.revenue?.value ? Math.round(k.revenue.value) : 0} change={k.revenue?.change} prefix="₹" />
            </div>

            {/* Charts + live */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="flex flex-col min-h-[340px] p-4 border rounded-xl bg-surface border-line lift">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[14px] font-semibold text-fg">Rides Overview</h3>
                        <span className="text-[12px] text-fg-3">{periodLabel(period)}</span>
                    </div>
                    <RidesOverviewChart days={model?.days} loading={loading} />
                </div>

                <div className="flex flex-col min-h-[340px] p-4 border rounded-xl bg-surface border-line lift">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[14px] font-semibold text-fg">Revenue Overview</h3>
                        <span className="text-[12px] text-fg-3">{periodLabel(period)}</span>
                    </div>
                    <RevenuePanel
                        days={model?.days}
                        total={model?.days?.reduce((a, d) => a + d.revenue, 0)}
                        change={k.revenue?.change}
                        loading={loading}
                    />
                </div>

                <LiveRidesPanel rides={live ?? []} loading={live === null} />
            </div>

            {/* Overviews + actions */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <BreakdownPanel
                    title="Driver Overview" viewAllTo="/drivers" loading={loading}
                    items={[
                        { label: 'Total Drivers', value: model?.driverBreakdown.total },
                        { label: 'Verified', value: model?.driverBreakdown.verified, tone: 'ok' },
                        { label: 'Pending Verification', value: model?.driverBreakdown.pending, tone: 'warn' },
                        { label: 'Online', value: model?.driverBreakdown.online, tone: 'ok' },
                        { label: 'Offline', value: model?.driverBreakdown.offline },
                        { label: 'Suspended', value: model?.driverBreakdown.suspended, tone: 'danger' },
                    ]}
                />
                <BreakdownPanel
                    title="Customer Overview" viewAllTo="/customers" loading={loading}
                    items={[
                        { label: 'Total Customers', value: model?.customerBreakdown.total },
                        { label: 'New Today', value: model?.customerBreakdown.newToday, tone: 'ok' },
                        { label: 'This Week', value: model?.customerBreakdown.newThisWeek },
                        { label: 'This Month', value: model?.customerBreakdown.newThisMonth },
                        { label: 'Active', value: null, unavailable: 'users has no active flag' },
                        { label: 'Blocked', value: null, unavailable: 'users has no blocked flag' },
                    ]}
                />
                <ActionRequired actions={model?.actions ?? []} loading={loading} />
            </div>

            {/* Recent activity */}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <RecentTable
                    title="Recent Rides" viewAllTo="/rides" loading={loading}
                    rows={model?.recentRides ?? []}
                    empty="No rides recorded yet."
                    columns={[
                        { key: 'route', header: 'Route', render: (r) => (
                            <span className="block max-w-[110px] truncate text-fg">
                                {r.pickupName || '—'} <span className="text-fg-3">→</span> {r.destName || '—'}
                            </span>
                        ) },
                        { key: 'driver', header: 'Driver', render: (r) => (
                            <span className="block max-w-[80px] truncate">{r.driverName || <span className="text-fg-3">—</span>}</span>
                        ) },
                        { key: 'fare', header: 'Fare', align: 'right', nowrap: true, render: (r) => (
                            <span className="font-mono text-fg">{formatCurrency(r.fare)}</span>
                        ) },
                        { key: 'status', header: 'Status', nowrap: true, render: (r) => (
                            <span className={statusStyle(r.status)}>{statusLabel(r.status)}</span>
                        ) },
                    ]}
                />

                <RecentTable
                    title="Recent Payments" viewAllTo="/payments" loading={loading}
                    rows={model?.recentPayments ?? []}
                    empty="No payments recorded yet."
                    columns={[
                        { key: 'id', header: 'Payment ID', render: (p) => (
                            <span className="font-mono text-[11px] text-fg">{(p.paymentId || p.id || '').slice(0, 14)}</span>
                        ) },
                        { key: 'customer', header: 'Customer', render: (p) => (
                            <span className="block max-w-[100px] truncate">{p.userName || p.userEmail || '—'}</span>
                        ) },
                        { key: 'amount', header: 'Amount', align: 'right', nowrap: true, render: (p) => (
                            <span className="font-mono text-fg">{money(p.amount)}</span>
                        ) },
                        { key: 'status', header: 'Status', nowrap: true, render: (p) => (
                            <span className={`pill ${p.status === 'success' ? 'pill-ok' : 'pill-danger'}`}>{p.status || 'unknown'}</span>
                        ) },
                    ]}
                />

                <RecentTable
                    title="Recent Reviews" viewAllTo="/reviews" loading={loading}
                    rows={model?.recentReviews ?? []}
                    empty="No reviews submitted yet."
                    columns={[
                        { key: 'rating', header: 'Rating', nowrap: true, render: (r) => (
                            <span className={`pill ${r.rating >= 4 ? 'pill-ok' : r.rating >= 3 ? 'pill-warn' : 'pill-danger'}`}>
                                {r.rating} ★
                            </span>
                        ) },
                        { key: 'driver', header: 'Driver', render: (r) => (
                            <span className="block max-w-[100px] truncate">{r.driverName || '—'}</span>
                        ) },
                        { key: 'vehicle', header: 'Vehicle', render: (r) => (
                            looksEncrypted(r.vehicleNumber)
                                ? <span className="font-mono text-[10px] text-fg-3">encrypted</span>
                                : <span className="font-mono text-[11px]">{r.vehicleNumber || '—'}</span>
                        ) },
                        { key: 'when', header: 'When', nowrap: true, render: (r) => (
                            <span className="text-fg-3">{formatAge(r.timestamp)}</span>
                        ) },
                    ]}
                />
            </div>

            <footer className="flex flex-col gap-1 pt-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-fg-3">&copy; 2026 FirstCabs. All rights reserved.</p>
                <p className="text-[11px] text-fg-3">Ride. A Better Tomorrow.</p>
            </footer>
        </div>
    );
}
