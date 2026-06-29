import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, orderBy } from 'firebase/firestore';

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
        console.log("Fetching global chat messages...");
        const qGlobal = query(collection(db, "global_chat"), orderBy("createdAt", "desc"), limit(5));
        const snapGlobal = await getDocs(qGlobal);
        snapGlobal.forEach((doc) => {
            console.log("GlobalMsg:", doc.id, "=>", doc.data());
        });

        // Let's also check messages from one of the issues if any
        console.log("Fetching issues...");
        const snapIssues = await getDocs(collection(db, "issues"));
        for (const issueDoc of snapIssues.docs) {
            console.log(`Fetching messages for issue ${issueDoc.id} (${issueDoc.data().title})...`);
            const qMsg = query(collection(db, `issues/${issueDoc.id}/messages`), orderBy("createdAt", "desc"), limit(5));
            const snapMsg = await getDocs(qMsg);
            snapMsg.forEach((mDoc) => {
                console.log(`IssueMsg [${issueDoc.id}]:`, mDoc.id, "=>", mDoc.data());
            });
        }
    } catch (e) {
        console.error("Error reading messages:", e);
    }
}

main();
