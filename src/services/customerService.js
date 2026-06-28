import { collection, getDocs, query, orderBy, doc, updateDoc, limit, startAfter } from 'firebase/firestore';
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
