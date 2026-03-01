import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

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

        // Try fetching subscriptions collection as well
        try {
            const subSnapshot = await getDocs(collection(db, "subscriptions"));
            const subsMap = {};
            subSnapshot.forEach(doc => {
                const data = doc.data();
                // Rule specifies resource.data.userId
                const uId = data.userId || data.driverId || doc.id;
                subsMap[uId] = { id: doc.id, ...data };
            });

            // Merge subscriptions
            driversData.forEach((driver, idx) => {
                const sub = subsMap[driver.id];
                if (sub) {
                    driver.subscriptionDetails = sub;
                    driver.hasSubscription = true;
                } else if (driver.subscription || driver.subscriptions || driver.subscriptionId) {
                    // It's a field directly on the driver
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

        return driversData;
    } catch (error) {
        console.error("Error fetching drivers:", error);
        throw error;
    }
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

// Update multiple fields for a driver
export const updateDriverDetails = async (driverId, updatedData) => {
    try {
        const driverRef = doc(db, "drivers", driverId);
        // ensure we only send defined data without updating ID itself
        const { id, ...dataToSave } = updatedData;
        await updateDoc(driverRef, dataToSave);
        return true;
    } catch (error) {
        console.error("Error updating driver details:", error);
        throw error;
    }
};

// Internal Mock Data Generator
export const generateMockDrivers = async () => {
    const mockDrivers = [
        {
            id: "d101",
            name: "Rahul Sharma",
            phone: "+91 9876543210",
            email: "rahul.s@example.com",
            vehicleType: "Sedan",
            isApproved: true,
            createdAt: new Date().toISOString(),
            status: "Online"
        },
        {
            id: "d102",
            name: "Priya Patel",
            phone: "+91 9988776655",
            email: "priya.p@example.com",
            vehicleType: "Mini",
            isApproved: false,
            createdAt: new Date().toISOString(),
            status: "Offline"
        },
        {
            id: "d103",
            name: "Amit Kumar",
            phone: "+91 9123456789",
            email: "amit.k@example.com",
            vehicleType: "SUV",
            isApproved: true,
            createdAt: new Date().toISOString(),
            status: "Online"
        }
    ];

    const mockSubscriptions = [
        {
            id: "sub1",
            driverId: "d101",
            planName: "Gold Pro",
            status: "Active",
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
            amount: 4999
        }
    ]

    for (const driver of mockDrivers) {
        await setDoc(doc(db, "drivers", driver.id), driver);
    }

    for (const sub of mockSubscriptions) {
        await setDoc(doc(db, "subscriptions", sub.id), sub);
    }

    console.log("Mock drivers and subscriptions generated successfully");
}
