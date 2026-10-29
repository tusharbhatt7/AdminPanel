// Driver wallet vocabulary.
//
// The ledger is written by Cloud Functions, and paise is its source of truth:
// every amount carries an integer *Paise field, with a rupee mirror alongside
// it for convenience. Read the paise field wherever one exists — the rupee
// mirror is a float and ₹0.1 + ₹0.2 does not equal ₹0.3 in binary floating
// point, so summing those drifts away from the balance the driver sees.

/** Integer paise from a document, falling back to the rupee mirror. */
export const toPaise = (paiseValue, rupeeValue) => {
    if (typeof paiseValue === 'number' && Number.isFinite(paiseValue)) return Math.round(paiseValue);
    if (typeof rupeeValue === 'number' && Number.isFinite(rupeeValue)) return Math.round(rupeeValue * 100);
    return null;
};

/** ₹1,234.50 — two decimals only when the amount is not a whole rupee. */
export const formatPaise = (paise) => {
    if (typeof paise !== 'number' || !Number.isFinite(paise)) return '—';
    const rupees = paise / 100;
    const whole = paise % 100 === 0;
    return `₹${rupees.toLocaleString('en-IN', {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2,
    })}`;
};

/** Same formatting, for the rupee-denominated fields on drivers/{id}. */
export const formatRupees = (rupees) =>
    typeof rupees === 'number' && Number.isFinite(rupees) ? formatPaise(Math.round(rupees * 100)) : '—';

/**
 * Signed, for a ledger row: −₹120 for a debit.
 *
 * The sign comes from `direction`, and the magnitude is taken absolute. A
 * debit written as a negative amountPaise would otherwise render "−₹-120",
 * and whichever convention the functions repo settles on, this reads correctly.
 */
export const formatSignedPaise = (paise, direction) => {
    if (typeof paise !== 'number' || !Number.isFinite(paise)) return '—';
    const text = formatPaise(Math.abs(paise));
    return direction === 'debit' ? `−${text}` : `+${text}`;
};

// ── Transaction types ────────────────────────────────────────────────────────
// ride_earning is the only type written today; the rest arrive with withdrawals
// and manual corrections. Unknown types render their raw value rather than
// being hidden, so a new type shipped by the functions repo is visible here the
// day it appears instead of silently vanishing from the ledger.

export const TXN_TYPE_LABELS = {
    ride_earning: 'Ride earning',
    withdrawal: 'Withdrawal',
    withdrawal_hold: 'Withdrawal hold',
    withdrawal_reversal: 'Withdrawal reversed',
    admin_adjustment: 'Manual adjustment',
    subscription: 'Subscription',
    commission: 'Commission',
};

export const txnTypeLabel = (type) =>
    TXN_TYPE_LABELS[type] || (type ? String(type).replace(/_/g, ' ') : 'Unknown');

export const LEG_LABELS = { fare: 'Fare', pickup: 'Pickup' };
export const legLabel = (leg) => LEG_LABELS[leg] || leg || null;

export const SOURCE_LABELS = {
    razorpay_qr: 'Razorpay QR',
    razorpay_checkout: 'Razorpay checkout',
};
export const sourceLabel = (source) =>
    SOURCE_LABELS[source] || (source ? String(source).replace(/_/g, ' ') : null);

export const directionTone = (direction) => (direction === 'debit' ? 'danger' : 'ok');

// ── Online payment credit outcomes ───────────────────────────────────────────
// Every online ride payment writes walletCredit.fare (and .pickup on parcels)
// onto the ride. Three outcomes are terminal and healthy; everything else is a
// payment that did not reach a driver's wallet and needs a person to look.

export const CREDIT_SETTLED = ['credited', 'already_credited', 'payment_already_used'];

export const CREDIT_STATUS = {
    credited: { label: 'Credited', tone: 'ok', blurb: 'Money reached the driver wallet.' },
    already_credited: { label: 'Duplicate', tone: 'neutral', blurb: 'A retry of a credit that already landed. Safe to ignore.' },
    payment_already_used: { label: 'Duplicate', tone: 'neutral', blurb: 'This Razorpay payment was already consumed. Safe to ignore.' },
    verification_failed: { label: 'Verification failed', tone: 'danger', blurb: 'Razorpay would not confirm this payment. Check it in the Razorpay dashboard before paying the driver.' },
    amount_mismatch: { label: 'Amount mismatch', tone: 'danger', blurb: 'The amount paid does not match the fare. Compare expected against actual.' },
    ride_mismatch: { label: 'Ride mismatch', tone: 'danger', blurb: 'The payment references a different ride. Needs manual tracing.' },
    payment_authorized: { label: 'Authorised, not captured', tone: 'warn', blurb: 'Razorpay authorised but never captured the money. Capture or refund it in Razorpay.' },
    driver_missing: { label: 'Driver missing', tone: 'warn', blurb: 'The ride has no driver record to credit. Resolve the ride, then adjust the wallet manually.' },
    no_driver: { label: 'No driver assigned', tone: 'warn', blurb: 'No driver was assigned to the ride. Resolve the ride, then adjust the wallet manually.' },
};

export const creditStatusMeta = (status) =>
    CREDIT_STATUS[status] || {
        label: status ? String(status).replace(/_/g, ' ') : 'Unknown',
        tone: 'warn',
        // A status the panel has never seen is not assumed healthy: the
        // "needs review" query is an exclusion list, so anything new lands in
        // the queue by design and a person decides what it means.
        blurb: 'Unrecognised outcome. Treat as unresolved until someone confirms what it means.',
    };

export const needsReview = (status) => !!status && !CREDIT_SETTLED.includes(status);

// ── Withdrawals ──────────────────────────────────────────────────────────────

export const WITHDRAWAL_STATUS = {
    pending: { label: 'Pending', tone: 'warn' },
    approved: { label: 'Approved', tone: 'ok' },
    paid: { label: 'Paid', tone: 'ok' },
    rejected: { label: 'Rejected', tone: 'danger' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
    processing: { label: 'Processing', tone: 'info' },
};

export const withdrawalStatusMeta = (status) =>
    WITHDRAWAL_STATUS[status] || { label: status || 'Unknown', tone: 'neutral' };

/**
 * A payout destination renders as a bank account or a UPI ID depending on
 * methodType. A UPI request has no account number or IFSC at all, so a bank
 * layout would print two empty rows and read as missing data rather than as a
 * different kind of payout.
 */
export const payoutDestination = (bankAccount) => {
    if (!bankAccount) return null;
    const isUpi = bankAccount.methodType === 'upi';
    return {
        isUpi,
        kind: isUpi ? 'UPI' : 'Bank transfer',
        holder: bankAccount.accountHolderName || bankAccount.name || null,
        upiId: isUpi ? bankAccount.upiId || null : null,
        bankName: isUpi ? null : bankAccount.bankName || null,
        accountNumber: isUpi ? null : bankAccount.accountNumber || null,
        ifsc: isUpi ? null : bankAccount.ifscCode || bankAccount.ifsc || null,
    };
};

/** Last four digits only — the full number is never needed to eyeball a row. */
export const maskAccount = (accountNumber) => {
    if (!accountNumber) return null;
    const digits = String(accountNumber).replace(/\s/g, '');
    return digits.length <= 4 ? digits : `••••${digits.slice(-4)}`;
};
