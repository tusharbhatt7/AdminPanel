import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { ACTIVE_STATUSES, PENDING_STATUSES, toDate } from '../lib/rideStatus';

/**
 * Live tracking reads two databases at once, and which one holds what is not
 * arbitrary:
 *
 *   Firestore  ride_requests      — the ride and who is on it. Changes rarely.
 *   RTDB       active_drivers/{id} — where the driver is. Changes every few
 *                                    seconds per driver, which is why it is
 *                                    not in Firestore.
 *
 * Nothing here writes. Everything returns an unsubscribe function, and the
 * callers must call it: a position listener left attached to a finished ride
 * keeps streaming coordinates nobody is looking at, and that is billed.
 */

// A driver whose last fix is older than this is shown as stale rather than
// moved — their app is closed, backgrounded or out of signal, and a marker
// that keeps sitting confidently on a street corner is worse than one that
// says it does not know.
export const STALE_AFTER_MS = 45_000;

export const TRACKED_STATUSES = ACTIVE_STATUSES;
export const TRACKED_WITH_SEARCHING = [...PENDING_STATUSES, ...ACTIVE_STATUSES];

/**
 * Rides currently worth watching. `includeSearching` adds rides still looking
 * for a driver — they have no driver position yet, but they are what dispatch
 * wants to see when nothing is being picked up.
 */
export const listenActiveRides = (onData, onError, { includeSearching = false } = {}) => {
    const statuses = includeSearching ? TRACKED_WITH_SEARCHING : TRACKED_STATUSES;

    return onSnapshot(
        query(collection(db, 'ride_requests'), where('status', 'in', statuses)),
        (snap) => {
            const rides = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (toDate(b.requestTime)?.getTime() ?? 0) - (toDate(a.requestTime)?.getTime() ?? 0));
            onData(rides);
        },
        (error) => { console.error('Active rides listen failed:', error); onError?.(error); },
    );
};

/** Shape one RTDB position node. Returns null when the node is absent. */
const normalisePosition = (value, { stale = false } = {}) => {
    if (!value) return null;
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const timestamp = Number(value.timestamp) || null;
    return {
        latitude,
        longitude,
        heading: Number.isFinite(Number(value.heading)) ? Number(value.heading) : null,
        speed: Number.isFinite(Number(value.speed)) ? Number(value.speed) : null,
        timestamp,
        // Explicitly stale (a Firestore fallback), or simply too old to trust.
        stale: stale || (timestamp ? Date.now() - timestamp > STALE_AFTER_MS : true),
    };
};

/**
 * One driver's live position.
 *
 * When the RTDB node is missing the driver's app is closed or disconnected, so
 * this falls back to drivers/{id}.lastLocation and flags it stale. That is a
 * real last-known position and worth showing — but never as a live one, or
 * dispatch will chase a car that stopped reporting twenty minutes ago.
 */
export const listenDriverPosition = (driverId, onData) => {
    if (!driverId || !rtdb) return () => {};

    const nodeRef = ref(rtdb, `active_drivers/${driverId}`);
    let fallbackUnsub = null;

    const stopFallback = () => { fallbackUnsub?.(); fallbackUnsub = null; };

    const startFallback = () => {
        if (fallbackUnsub) return;
        fallbackUnsub = onSnapshot(
            doc(db, 'drivers', driverId),
            (snap) => {
                const last = snap.data()?.lastLocation;
                onData(normalisePosition(
                    last && {
                        latitude: last.latitude ?? last.lat,
                        longitude: last.longitude ?? last.lng,
                        heading: last.heading,
                        speed: last.speed,
                        timestamp: toDate(last.updatedAt ?? last.timestamp)?.getTime() ?? null,
                    },
                    { stale: true },
                ));
            },
            (error) => console.error('lastLocation fallback failed:', error),
        );
    };

    const handler = onValue(
        nodeRef,
        (snap) => {
            const live = normalisePosition(snap.val());
            if (live) { stopFallback(); onData(live); }
            else startFallback();
        },
        (error) => { console.error('Driver position listen failed:', error); startFallback(); },
    );

    return () => { off(nodeRef, 'value', handler); stopFallback(); };
};

/**
 * Every driver reporting a position right now, as one subscription.
 *
 * A separate per-driver listener for each online driver would be dozens of
 * sockets to show one map layer; the parent node arrives in a single payload.
 */
export const listenAllDriverPositions = (onData, onError) => {
    if (!rtdb) return () => {};

    const nodeRef = ref(rtdb, 'active_drivers');
    const handler = onValue(
        nodeRef,
        (snap) => {
            const value = snap.val() ?? {};
            const positions = {};
            for (const [driverId, raw] of Object.entries(value)) {
                const position = normalisePosition(raw);
                if (position) positions[driverId] = position;
            }
            onData(positions);
        },
        (error) => { console.error('active_drivers listen failed:', error); onError?.(error); },
    );

    return () => off(nodeRef, 'value', handler);
};

/**
 * Last-known position for a driver who is not reporting live.
 *
 * A one-shot read rather than a listener: by definition this driver's app is
 * not running, so the value is not going to change while we watch it. Always
 * flagged stale — it is where the driver was, not where they are.
 */
export const fetchDriverLastLocation = async (driverId) => {
    if (!driverId) return null;
    try {
        const snap = await getDoc(doc(db, 'drivers', driverId));
        const last = snap.data()?.lastLocation;
        return normalisePosition(
            last && {
                latitude: last.latitude ?? last.lat,
                longitude: last.longitude ?? last.lng,
                heading: last.heading,
                speed: last.speed,
                timestamp: toDate(last.updatedAt ?? last.timestamp)?.getTime() ?? null,
            },
            { stale: true },
        );
    } catch (error) {
        console.error('lastLocation read failed:', error);
        return null;
    }
};

/** The passenger's own position during a ride, written by the rider app. */
export const listenPassengerPosition = (rideId, onData) => {
    if (!rideId) return () => {};

    return onSnapshot(
        doc(db, 'live_tracking', rideId),
        (snap) => {
            const d = snap.data();
            onData(normalisePosition(d && {
                latitude: d.latitude,
                longitude: d.longitude,
                timestamp: toDate(d.updatedAt)?.getTime() ?? null,
            }));
        },
        (error) => console.error('Passenger position listen failed:', error),
    );
};

/**
 * "12s ago" — position freshness, which is the number that tells you to trust
 * the dot.
 *
 * `now` is a parameter so a caller rendering many of these can pass one ticking
 * clock and have them all agree, and so a memo that builds labels can name the
 * clock as a real dependency instead of carrying a counter the linter rightly
 * calls unused. Falsy falls back to the live clock, which is what every
 * one-off caller wants.
 */
export const formatFix = (timestamp, now = 0) => {
    if (!timestamp) return 'no fix';
    const seconds = Math.max(0, Math.round(((now || Date.now()) - timestamp) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
};
