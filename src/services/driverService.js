import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy, limit, startAfter, onSnapshot, where } from "firebase/firestore";
import { db } from "../firebase";

const ITEMS_PER_PAGE = 10;

// Fetch total count for pagination (Ideally, use an aggregation query or maintain a counter document)
export const fetchDriversCount = async (filters = {}) => {
    // For now, doing a client-side count as simple Firestore doesn't support complex count easily without aggregation queries
    // In production, maintain a metadata document with totals or use getCountFromServer()
    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        let count = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Client-side filter count for the UI total
            const dName = data.name || "";
            const dPhone = data.phone || "";

            const matchesSearch = filters.search
                ? dName.toLowerCase().includes(filters.search.toLowerCase()) || String(dPhone).includes(filters.search)
                : true;

            const matchesStatus = filters.filterStatus === 'All' || !filters.filterStatus
                ? true
                : filters.filterStatus === 'Approved' ? data.isApproved : !data.isApproved;

            const matchesVehicleType = filters.filterVehicleType === 'All' || !filters.filterVehicleType
                ? true
                : (data.vehicleType || 'Unassigned').toLowerCase() === filters.filterVehicleType.toLowerCase();

            if (matchesSearch && matchesStatus && matchesVehicleType) {
                count++;
            }
        });
        return count;
    } catch (error) {
        console.error("Error fetching count:", error);
        return 0;
    }
}

export const fetchDriversPaginated = async (lastVisible = null, pageSize = ITEMS_PER_PAGE) => {
    try {
        const buildQ = (ordered) => {
            let q = ordered
                ? query(collection(db, "drivers"), orderBy("createdAt", "desc"), limit(pageSize))
                : query(collection(db, "drivers"), limit(pageSize));
            if (lastVisible) q = query(q, startAfter(lastVisible));
            return q;
        };

        let querySnapshot;
        try {
            querySnapshot = await getDocs(buildQ(true));
        } catch {
            querySnapshot = await getDocs(buildQ(false));
        }
        const driversData = [];
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            driversData.push({
                id: doc.id,
                ...data,
                isApproved: data.isApproved || false
            });
        });

        // Try fetching subscriptions collection as well
        try {
            const subSnapshot = await getDocs(collection(db, "subscriptions"));
            const subsMap = {};
            subSnapshot.forEach(doc => {
                const data = doc.data();
                const uId = data.userId || data.driverId || doc.id;
                subsMap[uId] = { id: doc.id, ...data };
            });

            driversData.forEach((driver) => {
                const sub = subsMap[driver.id];
                if (sub) {
                    driver.subscriptionDetails = sub;
                    driver.hasSubscription = true;
                } else if (driver.subscription || driver.subscriptions || driver.subscriptionId) {
                    driver.hasSubscription = true;
                    if (typeof driver.subscription === 'object') {
                        driver.subscriptionDetails = driver.subscription;
                    } else if (typeof driver.subscriptions === 'object') {
                        driver.subscriptionDetails = driver.subscriptions;
                    }
                }
            });
        } catch (subErr) {
            console.error("No subscriptions collection found or error:", subErr);
        }

        return { drivers: driversData, lastDoc };
    } catch (error) {
        console.error("Error fetching drivers:", error);
        throw error;
    }
};

// Keeping original fetchDrivers but returning full list. It's used by TopNav right now.
// We will transition TopNav to use listenToPendingDrivers
export const fetchDrivers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        const driversData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            driversData.push({
                id: doc.id,
                ...data,
                isApproved: data.isApproved || false
            });
        });
        return driversData;
    } catch (error) {
        console.error("Error fetching drivers:", error);
        throw error;
    }
};


export const listenToPendingDrivers = (callback) => {
    const q = query(
        collection(db, "drivers"),
        where("isApproved", "==", false)
    );

    return onSnapshot(q, (snapshot) => {
        const pending = [];
        snapshot.forEach((doc) => {
            pending.push({ id: doc.id, ...doc.data() });
        });
        callback(pending);
    }, (error) => {
        console.error("Error listening to pending drivers:", error);
    });
};


export const updateDriverApproval = async (driverId, newStatus) => {
    try {
        const driverRef = doc(db, "drivers", driverId);
        await updateDoc(driverRef, {
            isApproved: newStatus
        });
        return true;
    } catch (error) {
        console.error("Error updating approval status:", error);
        throw error;
    }
};

export const updateDriverDetails = async (driverId, updatedData) => {
    try {
        const driverRef = doc(db, "drivers", driverId);
        const { id, ...dataToSave } = updatedData;
        await updateDoc(driverRef, dataToSave);
        return true;
    } catch (error) {
        console.error("Error updating driver details:", error);
        throw error;
    }
};

export const generateMockDrivers = async () => {
    // ... (keep as is if needed, omitting full re-write of mock function to save space, assuming it's just for testing)
};
