import { collection, getDocs } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function run() {
    console.log("Fetching sample driver...");
    const dSnap = await getDocs(collection(db, "userId"));
    if(dSnap.empty) {
        const drSnap = await getDocs(collection(db, "drivers"));
        console.log("Drivers:", drSnap.docs.slice(0, 1).map(d => ({id: d.id, ...d.data()})));
    } else {
         console.log("userId docs:", dSnap.docs.slice(0, 1).map(d => ({id: d.id, ...d.data()})));
    }
    
    console.log("Fetching sample sub...");
    const sSnap = await getDocs(collection(db, "subscriptions"));
    console.log("Subs:", sSnap.docs.slice(0, 2).map(d => ({id: d.id, ...d.data()})));
    process.exit(0);
}
run().catch(console.error);
