import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { plainOrNull } from '../lib/pii';
import { shortRideId } from '../lib/activeRides';

/**
 * One search box that resolves to a record.
 *
 * Two hard constraints shape this:
 *
 * 1. Driver and customer phone numbers, licences and vehicle numbers are
 *    stored encrypted. Firestore cannot match on ciphertext, so a server-side
 *    `where('phone','==',…)` finds nothing. Matching therefore happens on the
 *    client, over decrypted-or-plain values, and silently misses records whose
 *    fields are encrypted — `encryptedFields` reports how many, so the UI can
 *    say so rather than implying "no match" means "does not exist".
 *
 * 2. `FC-ABC123` is the last six characters of a Firestore id, and a suffix
 *    cannot be looked up. So a short id is matched against recent rides rather
 *    than fetched directly. Pasting a full id still does a direct read.
 */

const RIDE_SCAN = 200;
const PEOPLE_SCAN = 400;
const CACHE_MS = 60_000;

// A palette searches on every keystroke. Without this each one would refetch
// two collections; with it, typing is free after the first character.
const cache = { at: 0, drivers: null, customers: null, rides: null };

// Firestore auto-ids are 20 characters, but requestRide() names ride
// documents after DateTime.now().millisecondsSinceEpoch -- 13 digits. A
// minimum of 16 meant pasting a real ride id never took the direct-read path.
const isFirestoreId = (q) => /^[A-Za-z0-9_-]{16,32}$/.test(q) || /^\d{10,16}$/.test(q);
const isShortRideId = (q) => /^FC-[A-Za-z0-9]{4,8}$/i.test(q);
const digitsOf = (q) => q.replace(/\D/g, '');

const loadCollections = async () => {
    if (cache.at && Date.now() - cache.at < CACHE_MS) return cache;

    const [drivers, customers, rides] = await Promise.all([
        getDocs(query(collection(db, 'drivers'), limit(PEOPLE_SCAN)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
            .catch(() => []),
        getDocs(query(collection(db, 'users'), limit(PEOPLE_SCAN)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
            .catch(() => []),
        getDocs(query(collection(db, 'ride_requests'), orderBy('requestTime', 'desc'), limit(RIDE_SCAN)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
            .catch(() => []),
    ]);

    Object.assign(cache, { at: Date.now(), drivers, customers, rides });
    return cache;
};

/** Force the next search to re-read. Used after an action changes a record. */
export const invalidateSearchCache = () => { cache.at = 0; };

const hit = (value, needle) => {
    const plain = plainOrNull(value);
    return !!plain && String(plain).toLowerCase().includes(needle);
};

const phoneHit = (value, digits) => {
    if (!digits || digits.length < 4) return false;
    const plain = plainOrNull(value);
    return !!plain && digitsOf(String(plain)).includes(digits);
};

/**
 * Resolve a query to candidate records, best match first.
 * Returns `{ results, encryptedFields, truncated }`.
 */
export const globalSearch = async (raw) => {
    const q = (raw ?? '').trim();
    if (q.length < 2) return { results: [], encryptedFields: 0, truncated: false };

    const needle = q.toLowerCase();
    const digits = digitsOf(q);
    const results = [];

    // A pasted document id is exact and worth a direct read — it is the one
    // path that does not depend on the record being inside the scan window.
    if (isFirestoreId(q)) {
        const [ride, driver, customer] = await Promise.all([
            getDoc(doc(db, 'ride_requests', q)).catch(() => null),
            getDoc(doc(db, 'drivers', q)).catch(() => null),
            getDoc(doc(db, 'users', q)).catch(() => null),
        ]);
        if (ride?.exists()) results.push(rideResult({ id: ride.id, ...ride.data() }, 'Exact id'));
        if (driver?.exists()) results.push(driverResult({ id: driver.id, ...driver.data() }, 'Exact id'));
        if (customer?.exists()) results.push(customerResult({ id: customer.id, ...customer.data() }, 'Exact id'));
        if (results.length) return { results, encryptedFields: 0, truncated: false };
    }

    const { drivers, customers, rides } = await loadCollections();

    let encryptedFields = 0;
    const countEncrypted = (...values) => {
        for (const v of values) if (typeof v === 'string' && v && !plainOrNull(v)) encryptedFields += 1;
    };

    for (const r of rides) {
        countEncrypted(r.userPhone, r.driverPhone, r.vehicleNumber);
        const matched = (isShortRideId(q) && shortRideId(r.id).toLowerCase() === needle)
            || r.id.toLowerCase().includes(needle)
            || hit(r.userName, needle) || hit(r.userEmail, needle) || hit(r.driverName, needle)
            || hit(r.vehicleNumber, needle)
            || phoneHit(r.userPhone, digits) || phoneHit(r.driverPhone, digits)
            || hit(r.pickupAddress, needle) || hit(r.destinationAddress, needle);
        if (matched) results.push(rideResult(r));
    }

    for (const d of drivers) {
        countEncrypted(d.phone, d.vehicleNumber);
        if (hit(d.name, needle) || hit(d.email, needle) || hit(d.vehicleNumber, needle)
            || phoneHit(d.phone, digits) || d.id.toLowerCase().includes(needle)) {
            results.push(driverResult(d));
        }
    }

    for (const c of customers) {
        countEncrypted(c.phone);
        if (hit(c.name, needle) || hit(c.email, needle)
            || phoneHit(c.phone, digits) || c.id.toLowerCase().includes(needle)) {
            results.push(customerResult(c));
        }
    }

    return {
        results: results.slice(0, 20),
        encryptedFields,
        // The scan is a window on the newest records, not the whole database.
        // Saying so is the difference between "not found" and "not in the last
        // 200 rides", which are very different answers for a dispatcher.
        truncated: rides.length >= RIDE_SCAN || drivers.length >= PEOPLE_SCAN || customers.length >= PEOPLE_SCAN,
    };
};

const rideResult = (r, why = null) => ({
    kind: 'ride',
    id: r.id,
    title: shortRideId(r.id),
    subtitle: [plainOrNull(r.userName) || plainOrNull(r.userEmail), plainOrNull(r.driverName), r.status].filter(Boolean).join(' · '),
    detail: [r.pickupAddress, r.destinationAddress ?? r.destAddress].filter(Boolean).join(' → '),
    path: `/rides?ride=${r.id}`,
    why,
});

const driverResult = (d, why = null) => ({
    kind: 'driver',
    id: d.id,
    title: plainOrNull(d.name) || 'Unnamed driver',
    subtitle: [plainOrNull(d.phone), plainOrNull(d.vehicleNumber), d.isApproved ? 'approved' : 'pending'].filter(Boolean).join(' · '),
    path: `/drivers?driver=${d.id}`,
    why,
});

const customerResult = (c, why = null) => ({
    kind: 'customer',
    id: c.id,
    title: plainOrNull(c.name) || 'Unnamed customer',
    subtitle: [plainOrNull(c.phone), plainOrNull(c.email)].filter(Boolean).join(' · '),
    path: `/customers?customer=${c.id}`,
    why,
});
