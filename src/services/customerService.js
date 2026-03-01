import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const fetchCustomers = async () => {
    try {
        const customersRef = collection(db, 'users');
        const q = query(customersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const customersList = [];
        querySnapshot.forEach((doc) => {
            customersList.push({ id: doc.id, ...doc.data() });
        });

        return customersList;
    } catch (error) {
        console.error("Error fetching customers: ", error);
        throw error;
    }
};

export const updateCustomerDetails = async (customerId, updatedData) => {
    try {
        const customerRef = doc(db, 'users', customerId);

        // Handle "NA" logic: if it's an empty string turning into a value, let it through. 
        // We aren't strictly casting empty inputs to "NA" here giving flexibility for now.
        await updateDoc(customerRef, updatedData);
        return true;
    } catch (error) {
        console.error("Error updating customer: ", error);
        throw error;
    }
};
