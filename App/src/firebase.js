import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    projectId: "fixbee-app-2026",
    appId: "1:341244386887:web:fa1a7651823d5254aadb62",
    storageBucket: "fixbee-app-2026.firebasestorage.app",
    apiKey: "AIzaSyBEtiefDZIrqN3p8UKMTsxIxknKAYUI2hY",
    authDomain: "fixbee-app-2026.firebaseapp.com",
    messagingSenderId: "341244386887",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
