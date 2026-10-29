import {
    collection, collectionGroup, doc, getDoc, getDocs, onSnapshot,
    query, where, orderBy, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { toPaise, CREDIT_SETTLED } from '../lib/wallet';
import { toDate } from '../lib/rideStatus';

/**
 * Driver wallet — read side.
 *
 * Nothing in this file writes a balance or a ledger row, and nothing should.
 * The rules would permit an admin to edit drivers/{id}.walletBalance directly,
 * but a balance moved that way leaves no wallet_transactions entry, so the
 * running balanceBefore/balanceAfter chain silently stops reconciling and
 * nobody can later explain where the money went. Every balance change goes
 * through the Cloud Function callables at the bottom of this file, which write
 * the row and the balance together.
 */

const PAGE_SIZE = 50;

const walletTxnsRef = (driverId) => collection(db, 'drivers', driverId, 'wallet_transactions');

/** One ledger row, with the paise fields resolved and the driver it belongs to. */
const normaliseTxn = (snap) => {
    const data = snap.data();
    return {
        id: snap.id,
        // A collection-group result does not carry the driver anywhere in its
        // own fields — only its path knows. drivers/{driverId}/wallet_transactions/{id}
        // means the grandparent document is the driver.
        driverId: snap.ref.parent.parent?.id ?? null,
        ...data,
        amountPaise: toPaise(data.amountPaise, data.amount),
        balanceBeforePaise: toPaise(data.balanceBeforePaise, data.balanceBefore),
        balanceAfterPaise: toPaise(data.balanceAfterPaise, data.balanceAfter),
    };
};

// ── Balance ──────────────────────────────────────────────────────────────────

/** The four balance fields on the driver document, in rupees as stored. */
export const fetchDriverBalance = async (driverId) => {
    const snap = await getDoc(doc(db, 'drivers', driverId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
        id: snap.id,
        name: d.name ?? null,
        phone: d.phone ?? null,
        walletBalance: d.walletBalance ?? 0,
        totalEarnings: d.totalEarnings ?? 0,
        onlineEarnings: d.onlineEarnings ?? 0,
        totalTrips: d.totalTrips ?? 0,
    };
};

/** Live balance for one driver — used beside the ledger so the two agree. */
export const listenDriverBalance = (driverId, onData, onError) =>
    onSnapshot(
        doc(db, 'drivers', driverId),
        (snap) => {
            if (!snap.exists()) return onData(null);
            const d = snap.data();
            onData({
                id: snap.id,
                name: d.name ?? null,
                phone: d.phone ?? null,
                walletBalance: d.walletBalance ?? 0,
                totalEarnings: d.totalEarnings ?? 0,
                onlineEarnings: d.onlineEarnings ?? 0,
                totalTrips: d.totalTrips ?? 0,
            });
        },
        (error) => { console.error('Driver balance listen failed:', error); onError?.(error); },
    );

// ── Ledger ───────────────────────────────────────────────────────────────────

/** One driver's history, newest first. */
export const listenDriverTransactions = (driverId, onData, onError) =>
    onSnapshot(
        query(walletTxnsRef(driverId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
        (snap) => onData(snap.docs.map(normaliseTxn)),
        (error) => { console.error('Wallet ledger listen failed:', error); onError?.(error); },
    );

export const fetchDriverTransactions = async (driverId, pageSize = PAGE_SIZE) => {
    const snap = await getDocs(query(walletTxnsRef(driverId), orderBy('createdAt', 'desc'), limit(pageSize)));
    return snap.docs.map(normaliseTxn);
};

/**
 * Every driver's ledger in one stream, newest first.
 *
 * This is a collection-group query, which needs both its own index and a rule
 * matching the group — a rule on drivers/{id}/wallet_transactions alone does
 * not grant it. Both are in firestore.indexes.json and firestore.rules.
 */
export const fetchAllTransactions = async (pageSize = PAGE_SIZE) => {
    const snap = await getDocs(
        query(collectionGroup(db, 'wallet_transactions'), orderBy('createdAt', 'desc'), limit(pageSize)),
    );
    return snap.docs.map(normaliseTxn);
};

export const listenAllTransactions = (onData, onError, pageSize = PAGE_SIZE) =>
    onSnapshot(
        query(collectionGroup(db, 'wallet_transactions'), orderBy('createdAt', 'desc'), limit(pageSize)),
        (snap) => onData(snap.docs.map(normaliseTxn)),
        (error) => { console.error('Wallet collection-group listen failed:', error); onError?.(error); },
    );

// ── Online payments that need review ─────────────────────────────────────────

/**
 * Online ride payments whose credit did not settle cleanly.
 *
 * Two queries rather than one because Firestore cannot OR two `not-in` filters
 * in a single query, and a parcel books two legs: the pickup payment and the
 * fare. Results are merged on ride id, so a ride with both legs broken appears
 * once carrying both.
 *
 * `not-in` also skips documents where the field is absent, which is exactly
 * right here — a cash ride never writes walletCredit and has nothing to review.
 */
const reviewQuery = (legField) =>
    query(
        collection(db, 'ride_requests'),
        where(`walletCredit.${legField}.status`, 'not-in', CREDIT_SETTLED),
        limit(PAGE_SIZE),
    );

export const fetchCreditsNeedingReview = async () => {
    const [fareSnap, pickupSnap] = await Promise.all([
        getDocs(reviewQuery('fare')),
        // A project with no parcel rides has no pickup leg indexed at all, and
        // the query fails rather than returning nothing. The fare queue is the
        // one that matters; it must not go blank because of that.
        getDocs(reviewQuery('pickup')).catch((error) => {
            console.warn('Pickup-leg review query unavailable:', error);
            return { docs: [] };
        }),
    ]);

    const byRide = new Map();
    for (const snap of [...fareSnap.docs, ...pickupSnap.docs]) {
        if (byRide.has(snap.id)) continue;
        byRide.set(snap.id, { id: snap.id, ...snap.data() });
    }

    return [...byRide.values()]
        .map((ride) => ({
            ...ride,
            // Only the legs that actually need attention, so the row renders
            // the problem rather than the healthy half of a parcel booking.
            brokenLegs: ['fare', 'pickup']
                .map((leg) => ({ leg, ...(ride.walletCredit?.[leg] ?? {}) }))
                .filter((entry) => entry.status && !CREDIT_SETTLED.includes(entry.status)),
        }))
        .sort((a, b) => (toDate(b.requestTime)?.getTime() ?? 0) - (toDate(a.requestTime)?.getTime() ?? 0));
};

// ── Withdrawals ──────────────────────────────────────────────────────────────

export const listenWithdrawalRequests = (onData, onError, { status = null } = {}) => {
    // status + requestedAt has a composite index; the unfiltered list does not
    // need one. Ordering is ascending for the pending queue so the driver who
    // has waited longest is handled first.
    const q = status
        ? query(collection(db, 'withdrawal_requests'), where('status', '==', status), orderBy('requestedAt', 'asc'))
        : query(collection(db, 'withdrawal_requests'), orderBy('requestedAt', 'desc'), limit(PAGE_SIZE));

    return onSnapshot(
        q,
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (error) => { console.error('Withdrawal listen failed:', error); onError?.(error); },
    );
};

/** The payout destination for one request. Bank or UPI — see payoutDestination. */
export const fetchBankAccount = async (bankAccountId) => {
    if (!bankAccountId) return null;
    const snap = await getDoc(doc(db, 'bank_accounts', bankAccountId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── Callables (asia-south1) ──────────────────────────────────────────────────
//
// These are the only paths that may move a balance. Each one writes the ledger
// row and the balance in the same server-side transaction.

const call = (name) => {
    if (!functions) throw new Error('Firebase is not configured.');
    return httpsCallable(functions, name);
};

/**
 * Approve a withdrawal. The bank transfer happens outside this panel first —
 * payoutReference is its UTR, recorded so a driver query can be traced back to
 * a real transfer. Approving without having sent the money leaves the ledger
 * claiming a payout that does not exist, which is why the UI demands the UTR.
 */
export const approveWithdrawal = (requestId, payoutReference) =>
    call('reviewWithdrawal')({ requestId, action: 'approve', payoutReference });

/** Reject a withdrawal. The held amount returns to the driver's wallet server-side. */
export const rejectWithdrawal = (requestId, reason) =>
    call('reviewWithdrawal')({ requestId, action: 'reject', reason });

/** Manual correction. amountPaise is a positive integer; direction sets the sign. */
export const adjustWallet = ({ driverId, amountPaise, direction, reason }) =>
    call('adminAdjustWallet')({ driverId, amountPaise, direction, reason });
