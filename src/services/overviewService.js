import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ACTIVE_STATUSES, toDate } from '../lib/rideStatus';

const DAY = 86400_000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Percent change between the selected window and the window immediately before
 * it. Returns null when there is no prior activity to compare against — showing
 * "+100%" against a zero baseline would be a lie dressed as a metric.
 */
const changeVs = (current, previous) => {
    if (previous === 0) return current === 0 ? 0 : null;
    return Math.round(((current - previous) / previous) * 100);
};

const safeAll = async (name) => {
    try {
        return (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error(`Could not read ${name}:`, error);
        return [];
    }
};

/**
 * Everything the overview needs, in one pass.
 *
 * Reads whole collections rather than issuing a dozen aggregation queries,
 * because the charts and recent-activity tables need the documents anyway.
 * That is ~490 reads per load at today's volumes; once ride_requests is into
 * the tens of thousands this should move to a rollup document maintained by a
 * Cloud Function.
 */
export const fetchOverview = async (periodDays = 30) => {
    const [rides, drivers, users, payments, ratings] = await Promise.all([
        safeAll('ride_requests'), safeAll('drivers'), safeAll('users'),
        safeAll('payments'), safeAll('ratings'),
    ]);

    const now = Date.now();
    const from = now - periodDays * DAY;
    const prevFrom = now - periodDays * 2 * DAY;

    const at = (row, field) => toDate(row[field])?.getTime() ?? null;
    const inWindow = (t, a, b) => t !== null && t >= a && t < b;

    const ridesIn = (a, b) => rides.filter((r) => inWindow(at(r, 'requestTime'), a, b));
    const curRides = ridesIn(from, now + DAY);
    const prevRides = ridesIn(prevFrom, from);

    const byStatus = (rows, s) => rows.filter((r) => r.status === s).length;
    const fareOf = (rows) => rows
        .filter((r) => r.status === 'completed')
        .reduce((sum, r) => sum + (typeof r.fare === 'number' ? r.fare : 0), 0);

    const newIn = (rows, a, b) => rows.filter((r) => inWindow(at(r, 'createdAt'), a, b)).length;

    // ── KPI row ──────────────────────────────────────────────────────────────
    const kpis = {
        totalRides: { value: rides.length, change: changeVs(curRides.length, prevRides.length) },
        activeRides: { value: rides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length, change: null },
        completedRides: { value: byStatus(rides, 'completed'), change: changeVs(byStatus(curRides, 'completed'), byStatus(prevRides, 'completed')) },
        cancelledRides: { value: byStatus(rides, 'cancelled'), change: changeVs(byStatus(curRides, 'cancelled'), byStatus(prevRides, 'cancelled')) },
        totalCustomers: { value: users.length, change: changeVs(newIn(users, from, now + DAY), newIn(users, prevFrom, from)) },
        totalDrivers: { value: drivers.length, change: changeVs(newIn(drivers, from, now + DAY), newIn(drivers, prevFrom, from)) },
        onlineDrivers: { value: drivers.filter((d) => d.isOnline === true).length, change: null },
        revenue: { value: fareOf(rides), change: changeVs(Math.round(fareOf(curRides)), Math.round(fareOf(prevRides))) },
    };

    // ── Daily series for the two charts ──────────────────────────────────────
    const days = [];
    const cursor = startOfDay(new Date(from));
    const today = startOfDay(new Date());
    while (cursor <= today) {
        days.push({
            date: new Date(cursor),
            completed: 0, ongoing: 0, cancelled: 0, pending: 0, revenue: 0,
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    const indexOfDay = new Map(days.map((d, i) => [d.date.toDateString(), i]));

    curRides.forEach((r) => {
        const t = toDate(r.requestTime);
        if (!t) return;
        const i = indexOfDay.get(startOfDay(t).toDateString());
        if (i === undefined) return;
        const bucket = days[i];
        if (r.status === 'completed') { bucket.completed += 1; bucket.revenue += typeof r.fare === 'number' ? r.fare : 0; }
        else if (r.status === 'cancelled') bucket.cancelled += 1;
        else if (r.status === 'requested') bucket.pending += 1;
        else bucket.ongoing += 1;
    });

    // ── Breakdown panels ─────────────────────────────────────────────────────
    const driverBreakdown = {
        total: drivers.length,
        verified: drivers.filter((d) => d.isApproved === true).length,
        pending: drivers.filter((d) => !d.isApproved).length,
        online: drivers.filter((d) => d.isOnline === true).length,
        offline: drivers.filter((d) => d.isOnline !== true).length,
        suspended: drivers.filter((d) => d.status === 'Blocked').length,
    };

    const customerBreakdown = {
        total: users.length,
        newToday: newIn(users, startOfDay(new Date()).getTime(), now + DAY),
        newThisWeek: newIn(users, now - 7 * DAY, now + DAY),
        newThisMonth: newIn(users, now - 30 * DAY, now + DAY),
        // `users` carries no active or blocked flag — see the schema audit.
        active: null,
        blocked: null,
    };

    // ── Action required ──────────────────────────────────────────────────────
    const lowRatings = ratings.filter((r) => typeof r.rating === 'number' && r.rating <= 2).length;
    const failedPayments = payments.filter((p) => p.status && p.status !== 'success').length;
    const stalledRides = rides.filter((r) =>
        ACTIVE_STATUSES.includes(r.status) && (now - (at(r, 'requestTime') ?? now)) > DAY).length;

    const actions = [
        { key: 'pending-drivers', tone: 'danger', count: driverBreakdown.pending, label: 'drivers pending verification', to: '/drivers?preset=pending' },
        { key: 'stalled', tone: 'warn', count: stalledRides, label: 'rides stuck in an active status', to: '/rides?status=active' },
        { key: 'low-ratings', tone: 'warn', count: lowRatings, label: 'low-rating reviews', to: '/reviews' },
        { key: 'failed-payments', tone: 'danger', count: failedPayments, label: 'payments not marked successful', to: '/payments' },
        { key: 'suspended', tone: 'info', count: driverBreakdown.suspended, label: 'drivers currently suspended', to: '/drivers' },
    ].filter((a) => a.count > 0);

    // ── Recent activity tables ───────────────────────────────────────────────
    const recentBy = (rows, field, n = 5) => [...rows]
        .sort((a, b) => (at(b, field) ?? 0) - (at(a, field) ?? 0))
        .slice(0, n);

    return {
        kpis,
        days,
        driverBreakdown,
        customerBreakdown,
        actions,
        recentRides: recentBy(rides, 'requestTime'),
        recentPayments: recentBy(payments, 'createdAt'),
        recentReviews: [...ratings].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 5),
        counts: { rides: rides.length, drivers: drivers.length, users: users.length },
    };
};

/** Active rides for the live panel, newest first. */
export const fetchLiveRides = async (max = 6) => {
    try {
        const snap = await getDocs(query(collection(db, 'ride_requests'), orderBy('requestTime', 'desc'), limit(120)));
        return snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => ACTIVE_STATUSES.includes(r.status))
            .slice(0, max);
    } catch (error) {
        console.error('Live rides failed:', error);
        return [];
    }
};
