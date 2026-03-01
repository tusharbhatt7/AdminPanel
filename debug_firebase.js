import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "./src/firebase.js";

const fetchDrivers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        const driversData = [];
        querySnapshot.forEach((doc) => {
            driversData.push({ id: doc.id, ...doc.data() });
        });

        // Try fetching subscriptions collection as well
        try {
            const subSnapshot = await getDocs(collection(db, "subscriptions"));
            const subsMap = {};
            subSnapshot.forEach(doc => {
                const data = doc.data();
                const driverId = data.driverId || doc.id;
                subsMap[driverId] = { id: doc.id, ...data };
            });

            // Merge subscriptions
            driversData.forEach(driver => {
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

fetchDrivers().then(d => {
    const hasSub = d.filter(x => x.hasSubscription);
    if(hasSub.length > 0) {
        console.log("Drivers with subs:", JSON.stringify(hasSub, null, 2));
    } else {
        console.log("No drivers with subs found. Total drivers:", d.length);
        console.log("First driver data sample:", JSON.stringify(d[0], null, 2));
    }
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
