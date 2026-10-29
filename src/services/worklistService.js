import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ACTIVE_STATUSES } from '../lib/rideStatus';
import { CREDIT_SETTLED } from '../lib/wallet';

/**
 * The counts that turn the sidebar from a menu into a worklist.
 *
 * Each is a live listener on a narrow query, so the badge changes the moment
 * the underlying record does. They are deliberately counts and not documents:
 * the sidebar is mounted on every screen, and streaming whole collections
 * behind every page would be paid for on every page.
 */

const safe = (label, build, onCount) => {
    try {
        return onSnapshot(
            build(),
            (snap) => onCount(snap.size),
            (error) => {
                // A missing index or a tightened rule must not take the whole
                // navigation down with it. The badge just does not appear.
                console.error(`Worklist (${label}) unavailable:`, error);
                onCount(null);
            },
        );
    } catch (error) {
        console.error(`Worklist (${label}) failed to start:`, error);
        onCount(null);
        return () => {};
    }
};

/**
 * Subscribe to every badge at once. `onChange` receives a partial patch each
 * time one of them moves; the caller merges.
 */
export const listenToWorklist = (onChange) => {
    const unsubs = [
        safe('activeRides',
            () => query(collection(db, 'ride_requests'), where('status', 'in', ACTIVE_STATUSES)),
            (n) => onChange({ activeRides: n })),

        safe('pendingDrivers',
            () => query(collection(db, 'drivers'), where('isApproved', '==', false)),
            (n) => onChange({ pendingDrivers: n })),

        safe('pendingWithdrawals',
            () => query(collection(db, 'withdrawal_requests'), where('status', '==', 'pending')),
            (n) => onChange({ pendingWithdrawals: n })),

        safe('creditsToReview',
            () => query(collection(db, 'ride_requests'),
                where('walletCredit.fare.status', 'not-in', CREDIT_SETTLED)),
            (n) => onChange({ creditsToReview: n })),

        safe('cancelRequests',
            () => query(collection(db, 'ride_cancel_requests'), where('status', '==', 'pending')),
            (n) => onChange({ cancelRequests: n })),
    ];

    return () => unsubs.forEach((u) => u());
};
