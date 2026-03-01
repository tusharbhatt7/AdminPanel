import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "./src/firebase.js";

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

generateMockDrivers().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
