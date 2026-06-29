import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    projectId: "fixbee-app-2026",
    appId: "1:341244386887:web:fa1a7651823d5254aadb62",
    storageBucket: "fixbee-app-2026.firebasestorage.app",
    apiKey: "AIzaSyBEtiefDZIrqN3p8UKMTsxIxknKAYUI2hY",
    authDomain: "fixbee-app-2026.firebaseapp.com",
    messagingSenderId: "341244386887",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
    try {
        console.log("Fetching users...");
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            console.log(doc.id, "=>", doc.data());
        });
    } catch (e) {
        console.error("Error reading users:", e);
    }
}

main();
