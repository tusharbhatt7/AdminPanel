import { ACTIVE_STATUSES, PENDING_STATUSES, toDate } from './rideStatus';
import { plainOrNull } from './pii';
import { CREDIT_SETTLED } from './wallet';

/**
 * Active-rides vocabulary: one shape for a ride document, and the issues a
 * dispatcher needs to spot without reading every field.
 */

// ── Normalisation ────────────────────────────────────────────────────────────
//
// The rider app writes `destinationAddress` / `destinationLat` / `destinationLng`
// (see RideRequestService.createRideRequest), while parts of this panel read
// `destAddress` / `destLat` / `destName`. Those fields do not exist on a ride,
// so destination has been rendering as an em dash. Both spellings are accepted
// here, and every screen that goes through this function gets the real value.

const firstNumber = (...values) => values.find((v) => typeof v === 'number' && Number.isFinite(v)) ?? null;
const firstString = (...values) => values.find((v) => typeof v === 'string' && v.trim()) ?? null;

/** A short, readable handle. The full Firestore id stays available to copy. */
export const shortRideId = (id) => (id ? `FC-${id.slice(-6).toUpperCase()}` : '—');

export const normaliseRide = (raw) => {
    if (!raw) return null;

    return {
        id: raw.id,
        shortId: shortRideId(raw.id),
        status: raw.status ?? null,
        rideType: firstString(raw.rideType, raw.type, raw.vehicleCategory),

        // PII arrives encrypted from the apps for some records; plainOrNull
        // returns null for ciphertext so the UI can say "encrypted" rather
        // than printing a base64 blob where a phone number belongs.
        customerName: plainOrNull(raw.userName),
        customerPhone: plainOrNull(raw.userPhone),
        customerId: raw.userId ?? null,

        driverId: raw.assignedDriverId ?? null,
        driverName: plainOrNull(raw.driverName),
        driverPhone: plainOrNull(raw.driverPhone),
        driverPhotoUrl: raw.driverPhotoUrl ?? null,
        driverRating: firstNumber(raw.driverRating),
        driverTotalTrips: firstNumber(raw.driverTotalTrips),

        vehicleNumber: plainOrNull(raw.vehicleNumber),
        vehicleType: firstString(raw.vehicleType, raw.vehicleCategory),
        vehicleDisplayName: firstString(
            raw.vehicleDisplayName,
            [raw.vehicleMake, raw.vehicleModel].filter(Boolean).join(' ') || null,
        ),

        fare: firstNumber(raw.fare),
        distanceKm: firstNumber(raw.tripDistance, raw.distanceKm),
        durationMin: firstNumber(raw.estimatedTripTime, raw.durationMin),
        pickupEtaMinutes: firstNumber(raw.pickupEtaMinutes, raw.estimatedArrivalTime),

        pickup: {
            address: firstString(raw.pickupAddress, raw.pickupName),
            lat: firstNumber(raw.pickupLat),
            lng: firstNumber(raw.pickupLng),
        },
        destination: {
            address: firstString(raw.destinationAddress, raw.destAddress, raw.destName),
            lat: firstNumber(raw.destinationLat, raw.destLat),
            lng: firstNumber(raw.destinationLng, raw.destLng),
        },

        paymentMode: firstString(raw.paymentMode, raw.paymentMethod),
        paymentStatus: firstString(raw.paymentStatus),
        paymentCollected: raw.paymentCollected ?? null,
        walletCredit: raw.walletCredit ?? null,

        requestTime: raw.requestTime ?? raw.createdAt ?? null,
        acceptedAt: raw.acceptedAt ?? null,
        arrivedAt: raw.arrivedAt ?? null,
        startedAt: raw.startedAt ?? null,
        completedAt: raw.completedAt ?? null,
        cancelledAt: raw.cancelledAt ?? null,
        updatedAt: raw.updatedAt ?? null,

        cancelledBy: raw.cancelledBy ?? null,
        cancelReason: raw.cancelReason ?? null,

        dispatchStatus: raw.dispatchStatus ?? null,
        raw,
    };
};

// ── Grouping ─────────────────────────────────────────────────────────────────
//
// "Awaiting pickup" is the driver on their way; "in progress" is the passenger
// or parcel aboard. Parcel legs (collected / delivered) count as in progress —
// the goods have been picked up, which is the same side of the line.

export const AWAITING_STATUSES = ['accepted', 'arriving', 'arrived'];
export const IN_PROGRESS_STATUSES = ['started', 'inProgress', 'collected', 'delivered'];

export const TRACKED_STATUSES = ACTIVE_STATUSES;
export const SEARCHING_STATUSES = PENDING_STATUSES;

// ── Issues ───────────────────────────────────────────────────────────────────
//
// Every issue below is derived from something actually stored. Route deviation
// and "driver not moving" are deliberately absent: both need a planned route
// and a position history that nothing in this system records, and inventing
// them would put a confident number on a screen people make decisions from.

/** A driver silent for longer than this on a live ride is a problem, not a lull. */
export const SIGNAL_LOST_MS = 45_000;

/** Grace on top of the promised pickup ETA before a ride is called late. */
const LATE_GRACE_MIN = 3;

/** A ride nobody has accepted after this long is not going to self-resolve. */
const UNASSIGNED_WARN_MS = 180_000;

/**
 * Problems worth a dispatcher's attention, derived from what is stored.
 *
 * `nowMs` is a parameter, and falsy falls back to the live clock. Callers that
 * render many rides pass one ticking value so every row agrees about the time,
 * and so a memo can name the clock as a real dependency instead of reading
 * Date.now() during render.
 */
export const deriveIssues = (ride, position, nowMs = 0) => {
    const now = nowMs || Date.now();
    const issues = [];
    if (!ride) return issues;

    const isLive = TRACKED_STATUSES.includes(ride.status);

    // Location — the single most common dispatch question.
    if (isLive && ride.driverId) {
        if (!position) {
            issues.push({
                key: 'no_signal', label: 'No Driver Signal', tone: 'danger',
                short: 'No location',
                detail: 'The driver app has never reported a position for this ride.',
            });
        } else if (position.stale) {
            const age = position.timestamp ? Math.round((now - position.timestamp) / 1000) : null;
            const ageText = age == null ? null : age < 120 ? `${age}s` : `${Math.round(age / 60)} min`;
            issues.push({
                key: 'location_stale', label: 'Location Not Updating', tone: 'danger',
                short: ageText ? `No location (${ageText})` : 'No location',
                detail: ageText
                    ? `Last location received ${ageText} ago. Driver may have poor network, or the app is not running.`
                    : 'No recent fix. Driver may have poor network, or the app is not running.',
            });
        }
    }

    // Late to pickup, measured against the ETA the driver committed to on accept.
    if (AWAITING_STATUSES.includes(ride.status) && ride.pickupEtaMinutes && ride.acceptedAt) {
        const due = (toDate(ride.acceptedAt)?.getTime() ?? 0) + ride.pickupEtaMinutes * 60_000;
        const lateMin = Math.round((now - due) / 60_000);
        if (lateMin > LATE_GRACE_MIN) {
            issues.push({
                key: 'delayed', label: 'Delayed', tone: 'warn',
                short: `Delayed by ${lateMin} min`,
                detail: `Late by ${lateMin} min against a ${ride.pickupEtaMinutes} min pickup ETA.`,
            });
        }
    }

    // Still searching. Dispatch gives up on its own, but someone should know.
    if (SEARCHING_STATUSES.includes(ride.status)) {
        const waited = now - (toDate(ride.requestTime)?.getTime() ?? now);
        if (waited > UNASSIGNED_WARN_MS) {
            issues.push({
                key: 'unassigned', label: 'No Driver Yet', tone: 'warn',
                short: `Searching ${Math.round(waited / 60_000)} min`,
                detail: `Searching for ${Math.round(waited / 60_000)} min with no driver accepting.`,
            });
        }
    }

    // Money.
    if (ride.paymentStatus === 'failed') {
        issues.push({
            key: 'payment_failed', label: 'Payment Failed', tone: 'danger',
            short: ride.paymentMode ? `Failed (${ride.paymentMode})` : 'Payment failed',
            detail: `Payment did not go through${ride.paymentMode ? ` (${ride.paymentMode})` : ''}.`,
        });
    }

    for (const leg of ['fare', 'pickup']) {
        const entry = ride.walletCredit?.[leg];
        if (entry?.status && !CREDIT_SETTLED.includes(entry.status)) {
            issues.push({
                key: `credit_${leg}`, label: 'Payment Needs Review', tone: 'warn',
                short: 'Wallet not credited',
                detail: `The ${leg} payment did not reach the driver’s wallet (${entry.status.replace(/_/g, ' ')}).`,
            });
            break;
        }
    }

    return issues;
};

export const worstTone = (issues) =>
    issues.some((i) => i.tone === 'danger') ? 'danger'
        : issues.some((i) => i.tone === 'warn') ? 'warn'
            : null;

// ── Timeline ─────────────────────────────────────────────────────────────────
//
// `arrivedAt` is listed although no app writes it today: the status exists and
// the step belongs in the sequence, so it renders as pending rather than being
// hidden. A missing timestamp is information — it says nobody recorded arrival.

export const rideTimeline = (ride) => {
    if (!ride) return [];
    const cancelled = ride.status === 'cancelled';

    const steps = [
        { key: 'requested', label: 'Ride requested', at: ride.requestTime },
        { key: 'accepted', label: 'Driver accepted', at: ride.acceptedAt },
        { key: 'arrived', label: 'Arrived at pickup', at: ride.arrivedAt },
        { key: 'started', label: 'Trip started', at: ride.startedAt },
        { key: 'completed', label: 'Trip completed', at: ride.completedAt },
    ];

    if (cancelled) {
        const reached = steps.filter((s) => s.at);
        return [
            ...reached,
            {
                key: 'cancelled',
                label: `Cancelled${ride.cancelledBy ? ` by ${ride.cancelledBy}` : ''}`,
                at: ride.cancelledAt,
                tone: 'danger',
            },
        ];
    }
    return steps;
};
