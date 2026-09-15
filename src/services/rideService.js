import {
    collection, query, where, orderBy, limit, startAfter,
    getDocs, onSnapshot,
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
