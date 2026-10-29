import {
    collection, doc, query, where, orderBy, limit, startAfter,
    getDocs, getDoc, onSnapshot, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const PAGE_SIZE = 25;
const LIVE_LIMIT = 200;

const statusConstraint = (statuses) =>
    statuses && statuses.length ? [where('status', 'in', statuses)] : [];

/**
 * One page of rides, newest first. `statuses` of null means every ride.
 * Requires the composite index (status ASC, requestTime DESC) from
 * firestore.indexes.json whenever statuses is set.
 */
export const fetchRidesPage = async ({ statuses = null, lastDoc = null, pageSize = PAGE_SIZE } = {}) => {
    const constraints = [
        ...statusConstraint(statuses),
        orderBy('requestTime', 'desc'),
        ...(lastDoc ? [startAfter(lastDoc)] : []),
        limit(pageSize),
    ];

    const snapshot = await getDocs(query(collection(db, 'ride_requests'), ...constraints));

    return {
        rides: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === pageSize,
    };
};

/**
 * Live ride feed, used for the presets an admin watches rather than browses
 * (active and pending). Capped at LIVE_LIMIT; `atLimit` tells the UI to say so
 * instead of quietly truncating.
 */
export const listenToRides = (statuses, onUpdate, onError) => {
    const q = query(
        collection(db, 'ride_requests'),
        ...statusConstraint(statuses),
        orderBy('requestTime', 'desc'),
        limit(LIVE_LIMIT),
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const rides = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            onUpdate({ rides, atLimit: rides.length === LIVE_LIMIT });
        },
        (error) => {
            console.error('Ride listener failed:', error);
            onError?.(error);
        },
    );
};

/**
 * Cancel a ride from the panel.
 *
 * `cancelledBy: 'admin'` matters: the rider and driver apps both write this
 * field with their own value, and support cannot tell a rider who abandoned a
 * booking from one dispatch pulled off a stuck driver unless the panel names
 * itself here too.
 *
 * Only the terminal state is written. Dispatch fields are left alone — the
 * rules reject a client touching them, and the functions that own dispatch
 * read the status change and wind the offer down themselves.
 */
export const cancelRideAsAdmin = async (rideId, reason) => {
    await updateDoc(doc(db, 'ride_requests', rideId), {
        status: 'cancelled',
        cancelledBy: 'admin',
        cancelledAt: serverTimestamp(),
        cancelReason: reason,
        updatedAt: serverTimestamp(),
    });
};

/**
 * Every ride for one person, newest first.
 *
 * `field` is 'userId' for a customer or 'assignedDriverId' for a driver. Both
 * need a composite index with requestTime; they are in firestore.indexes.json.
 * The driver one is new — a ride has never been queried by its driver before.
 */
export const fetchRidesForParty = async ({ field, value, pageSize = PAGE_SIZE }) => {
    const snapshot = await getDocs(query(
        collection(db, 'ride_requests'),
        where(field, '==', value),
        orderBy('requestTime', 'desc'),
        limit(pageSize),
    ));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** One ride by id, for a deep link that arrives before any list has loaded. */
export const fetchRideById = async (rideId) => {
    const snap = await getDoc(doc(db, 'ride_requests', rideId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
