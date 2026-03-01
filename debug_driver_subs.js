import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "./src/firebase.js";

const fetchDriversParams = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        const driversData = [];
        querySnapshot.forEach((doc) => {
            driversData.push({ id: doc.id, ...doc.data() });
        });

        return driversData;
    } catch (error) {
        console.error("Error fetching drivers:", error);
    }
};

fetchDriversParams().then(d => {
    if(d) {
        const hasSub = d.filter(x => x.subscription || x.subscriptions || x.subscriptionId || x.subscriptionDetails);
        if(hasSub.length > 0) {
            console.log("Drivers with subs inside their doc:", JSON.stringify(hasSub, null, 2));
        } else {
            console.log("No drivers with embedded subs found in drivers collection. Total drivers:", d.length);
        }
    }
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
