import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            setCurrentUser(user);
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                
                // Ensure document exists first
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const newProfile = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || 'Anonymous',
                        photoURL: user.photoURL || '',
                        role: 'user',
                        points: 0,
                        badges: ['first_report'],
                        reportsCount: 0,
                        upvotesGiven: 0,
                        locationGranted: false,
                        pincode: null,
                        societyId: null,
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(userRef, newProfile);
                }

                // Subscribe to real-time updates
                unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setUserProfile(snapshot.data());
                    }
                    setLoading(false);
                });
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const signIn = async (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email, password, name) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Update Firebase Auth Profile
        await updateProfile(user, {
            displayName: name.trim()
        });

        // 2. Set/Update Firestore User Profile
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            displayName: name.trim(),
            display_name: name.trim()
        }, { merge: true });

        return userCredential;
    };

    const signInWithGoogle = async () => {
        return signInWithPopup(auth, googleProvider);
    };

    const signOut = async () => {
        return firebaseSignOut(auth);
    };

    const value = {
        currentUser,
        userProfile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
