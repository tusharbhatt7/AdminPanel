import { collection, getDocs, getDoc, query, orderBy, doc, updateDoc, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase';

const ITEMS_PER_PAGE = 10;

export const fetchCustomersPaginated = async (lastVisible = null, pageSize = ITEMS_PER_PAGE) => {
    const run = async (ordered) => {
        let q = ordered
            ? query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(pageSize))
            : query(collection(db, 'users'), limit(pageSize));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        const snapshot = await getDocs(q);
        return {
            customers: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            lastDoc: snapshot.docs[snapshot.docs.length - 1],
        };
    };

    try {
        return await run(true);
    } catch {
        try {
            return await run(false);
        } catch (error) {
            console.error("Error fetching customers paginated: ", error);
            throw error;
        }
    }
};


export const fetchCustomers = async () => {
    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        try {
            const snapshot = await getDocs(collection(db, 'users'));
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error("Error fetching customers: ", error);
            throw error;
        }
    }
};

export const updateCustomerDetails = async (customerId, updatedData) => {
    try {
        const customerRef = doc(db, 'users', customerId);

        // Handle "NA" logic: if it's an empty string turning into a value, let it through. 
        // We aren't strictly casting empty inputs to "NA" here giving flexibility for now.
        const { id, ...dataToSave } = updatedData;
        await updateDoc(customerRef, dataToSave);
        return true;
    } catch (error) {
        console.error("Error updating customer: ", error);
        throw error;
    }
};

/**
 * One customer by id, cached for the life of the tab.
 *
 * The ride document carries only `userId` and `userEmail` -- the rider app
 * never writes a name or phone onto a ride (see requestRide in
 * ride_provider.dart). Anything that wants to show who booked has to come
 * here, and a dispatch screen asks for the same handful of customers
 * repeatedly, so the result is kept.
 */
const customerCache = new Map();

export const fetchCustomerById = async (userId) => {
    if (!userId) return null;
    if (customerCache.has(userId)) return customerCache.get(userId);

    try {
        const snap = await getDoc(doc(db, 'users', userId));
        const value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        customerCache.set(userId, value);
        return value;
    } catch (error) {
        console.error('Customer lookup failed:', error);
        // Not cached: a permission blip should not poison the entry for the
        // rest of the session.
        return null;
    }
};
