// Ride status vocabulary.
//
// Sourced from the deployed Firestore ruleset (firestore.rules) and verified on
// 2026-09-15 against all 430 live ride_requests documents. Every status below
// was observed in production except `inProgress`, which the rules permit and the
// driver app can write, so it is treated as active.

export const PENDING_STATUSES = ['requested'];

// A ride that a driver has taken and has not yet finished or cancelled.
export const ACTIVE_STATUSES = [
    'accepted',
    'arriving',
    'arrived',
    'started',
    'inProgress',
    'collected',
    'delivered',
];

export const CANCELLED_STATUSES = ['cancelled'];
export const COMPLETED_STATUSES = ['completed'];

// A ride sitting in an active status for longer than this has almost certainly
// been abandoned rather than left running — the apps have no way to close it out.
export const STALE_ACTIVE_HOURS = 24;

export const RIDE_PRESETS = {
    all: { label: 'All Rides', statuses: null, blurb: 'Every ride request ever created.' },
    active: { label: 'Active Rides', statuses: ACTIVE_STATUSES, blurb: 'Driver assigned, ride under way.', live: true },
    pending: { label: 'Pending Rides', statuses: PENDING_STATUSES, blurb: 'Rider waiting for a driver to accept.', live: true },
    cancelled: { label: 'Cancelled Rides', statuses: CANCELLED_STATUSES, blurb: 'Cancelled by rider, driver or dispatch.' },
    completed: { label: 'Completed Rides', statuses: COMPLETED_STATUSES, blurb: 'Ride finished and closed out.' },
};

export const isRidePreset = (key) => Object.prototype.hasOwnProperty.call(RIDE_PRESETS, key);

// Semantic tone per status, mapped once. Waiting reads as warning, in-flight as
// informational, parcel handling as its own colour, terminal states as ok/danger.
const STATUS_TONE = {
    requested: 'warn',
    accepted: 'info',
    arriving: 'info',
    arrived: 'info',
    started: 'brand',
    inProgress: 'brand',
    collected: 'violet',
    delivered: 'violet',
    completed: 'ok',
    cancelled: 'danger',
};

export const statusTone = (status) => STATUS_TONE[status] || 'neutral';

/** Full class string for a status pill. */
export const statusStyle = (status) => `pill pill-${statusTone(status)}`;

/** Colour for the 2px row stripe, which scans faster than reading the word. */
export const statusStripe = (status) => {
    const tone = statusTone(status);
    return tone === 'neutral' ? 'var(--c-line-strong)' : `var(--c-${tone})`;
};

export const statusLabel = (status) =>
    status ? status.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) : 'Unknown';

// Firestore is inconsistent about time across this project: ride_requests uses a
// Timestamp, wallet uses an ISO string, ratings uses epoch millis. Accept all of them.
export const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

export const isStaleActive = (ride) => {
    const requested = toDate(ride?.requestTime);
    if (!requested) return false;
    return Date.now() - requested.getTime() > STALE_ACTIVE_HOURS * 3600_000;
};

export const formatAge = (value) => {
    const date = toDate(value);
    if (!date) return '—';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
};

export const formatDateTime = (value) => {
    const date = toDate(value);
    return date
        ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
};

export const formatCurrency = (amount) =>
    typeof amount === 'number' ? `₹${amount.toLocaleString('en-IN')}` : '—';
