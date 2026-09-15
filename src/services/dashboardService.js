import {
    collection, query, where, orderBy, limit,
    getCountFromServer, getDocs, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    ACTIVE_STATUSES, PENDING_STATUSES, CANCELLED_STATUSES,
    isStaleActive,
} from '../lib/rideStatus';

// Counts come from Firestore's server-side aggregation rather than by reading every
// document. The panel's older count paths downloaded whole collections to call
// .length on them, which gets expensive as ride_requests grows.
const countOf = async (path, ...constraints) => {
    const target = constraints.length
        ? query(collection(db, path), ...constraints)
        : collection(db, path);
    const snapshot = await getCountFromServer(target);
    return snapshot.data().count;
};

// One failing metric (a missing index, a rules change) should blank one card,
// not take down the whole dashboard.
const safeCount = async (label, path, ...constraints) => {
    try {
        return await countOf(path, ...constraints);
    } catch (error) {
        console.error(`Dashboard metric "${label}" failed:`, error);
        return null;
    }
};

export const NEW_WINDOW_OPTIONS = [
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
];

export const cutoffFor = (days) =>
    Timestamp.fromDate(new Date(Date.now() - days * 86400_000));

/**
 * Every dashboard metric except active rides, which is live (see listenToActiveRides).
 * Any individual metric resolves to null if its query fails.
 */
export const fetchDashboardStats = async (newWindowDays = 30) => {
    const since = cutoffFor(newWindowDays);

    const [
        totalRides, pendingRides, cancelledRides, completedRides,
        totalCustomers, newCustomers,
        totalDrivers, activeDrivers, newDrivers,
    ] = await Promise.all([
        safeCount('totalRides', 'ride_requests'),
        safeCount('pendingRides', 'ride_requests', where('status', 'in', PENDING_STATUSES)),
        safeCount('cancelledRides', 'ride_requests', where('status', 'in', CANCELLED_STATUSES)),
        safeCount('completedRides', 'ride_requests', where('status', '==', 'completed')),
        safeCount('totalCustomers', 'users'),
        safeCount('newCustomers', 'users', where('createdAt', '>=', since)),
        safeCount('totalDrivers', 'drivers'),
        safeCount('activeDrivers', 'drivers', where('isOnline', '==', true)),
        safeCount('newDrivers', 'drivers', where('createdAt', '>=', since)),
    ]);

    return {
        totalRides, pendingRides, cancelledRides, completedRides,
        totalCustomers, newCustomers,
        totalDrivers, activeDrivers, newDrivers,
    };
};

/**
 * Active rides are the one metric an admin acts on in the moment, so they stream
 * rather than poll. Reports the stale subset too — rides stuck in an active status
 * for over a day, which neither app can close out on its own.
 */
export const listenToActiveRides = (onUpdate, onError) => {
    const q = query(
        collection(db, 'ride_requests'),
        where('status', 'in', ACTIVE_STATUSES),
        orderBy('requestTime', 'desc'),
        limit(200),
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const rides = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            onUpdate({
                count: rides.length,
                staleCount: rides.filter(isStaleActive).length,
                atLimit: rides.length === 200,
            });
        },
        (error) => {
            console.error('Active rides listener failed:', error);
            onError?.(error);
        },
    );
};

/**
 * Daily ride counts for the trend chart. Returns one bucket per calendar day in
 * the window, including days with zero rides — the gaps are real information
 * here, since activity on this platform is bursty rather than continuous.
 *
 * Costs one document read per ride in the window (~195 over 90 days today), so
 * it is fetched separately from the counts and never blocks them.
 */
export const fetchRideVolume = async (days = 90) => {
    const since = cutoffFor(days);
    const q = query(
        collection(db, 'ride_requests'),
        where('requestTime', '>=', since),
        orderBy('requestTime', 'asc'),
    );

    const snapshot = await getDocs(q);

    // Pre-seed every day so a quiet day renders as zero rather than disappearing.
    const buckets = new Map();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const cursor = startOfDay(since.toDate());
    const today = startOfDay(new Date());
    while (cursor <= today) {
        buckets.set(cursor.toISOString().slice(0, 10), { date: new Date(cursor), total: 0, completed: 0, cancelled: 0 });
        cursor.setDate(cursor.getDate() + 1);
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        const at = data.requestTime?.toDate?.();
        if (!at) return;
        const bucket = buckets.get(startOfDay(at).toISOString().slice(0, 10));
        if (!bucket) return;
        bucket.total += 1;
        if (data.status === 'completed') bucket.completed += 1;
        else if (data.status === 'cancelled') bucket.cancelled += 1;
    });

    return [...buckets.values()];
};

/** Live count of riders currently waiting for a driver to accept. */
export const listenToPendingRides = (onUpdate, onError) => {
    const q = query(collection(db, 'ride_requests'), where('status', 'in', PENDING_STATUSES));
    return onSnapshot(
        q,
        (snapshot) => onUpdate({ count: snapshot.size }),
        (error) => {
            console.error('Pending rides listener failed:', error);
            onError?.(error);
        },
    );
};
