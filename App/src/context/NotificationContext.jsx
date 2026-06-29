import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    limit
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useIssues } from './IssueContext';

const NotificationContext = createContext();

export function useNotifications() {
    return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
    const { currentUser } = useAuth();
    const { issues } = useIssues();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!currentUser || !issues || issues.length === 0) return;

        const checkExpiryNotifications = async () => {
            const myIssues = issues.filter(i => i.reporterId === currentUser.uid);
            const now = Date.now();
            const threeDaysLimit = 3 * 24 * 60 * 60 * 1000;
            const tenDaysLimit = 10 * 24 * 60 * 60 * 1000;

            for (const issue of myIssues) {
                const issueCreatedAt = new Date(issue.createdAt).getTime();
                const ageMs = now - issueCreatedAt;

                // Helper to get milliseconds from Firestore Timestamp or other types
                const getMs = (val) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val.seconds) return val.seconds * 1000;
                    return new Date(val).getTime();
                };

                // 1. Check expiry warning (between 7 and 10 days)
                if (ageMs >= (tenDaysLimit - threeDaysLimit) && ageMs < tenDaysLimit) {
                    const hasWarning = notifications.some(n => 
                        n.relatedIssueId === issue.id && 
                        n.type === 'expiry_warning' && 
                        getMs(n.createdAt) > issueCreatedAt
                    );

                    if (!hasWarning) {
                        try {
                            await addDoc(collection(db, 'notifications'), {
                                userId: currentUser.uid,
                                type: 'expiry_warning',
                                icon: 'schedule',
                                color: '#4991ff',
                                title: 'Report expires soon →',
                                body: `Your "${issue.title}" report expires in 3 days`,
                                read: false,
                                createdAt: serverTimestamp(),
                                relatedIssueId: issue.id
                            });
                        } catch (e) {
                            console.error('Error creating expiry warning notification:', e);
                        }
                    }
                }

                // 2. Check expired (10 days or older)
                if (ageMs >= tenDaysLimit) {
                    const hasExpired = notifications.some(n => 
                        n.relatedIssueId === issue.id && 
                        n.type === 'expired' && 
                        getMs(n.createdAt) > issueCreatedAt
                    );

                    if (!hasExpired) {
                        try {
                            await addDoc(collection(db, 'notifications'), {
                                userId: currentUser.uid,
                                type: 'expired',
                                icon: 'notifications',
                                color: '#64748b',
                                title: 'Report became inactive →',
                                body: `Your "${issue.title}" report has expired. Refresh it from your profile to keep it visible!`,
                                read: false,
                                createdAt: serverTimestamp(),
                                relatedIssueId: issue.id
                            });
                        } catch (e) {
                            console.error('Error creating expired notification:', e);
                        }
                    }
                }
            }
        };

        checkExpiryNotifications();
    }, [currentUser, issues, notifications]);

    useEffect(() => {
        if (!currentUser) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = [];
            let unread = 0;
            snapshot.forEach((doc) => {
                const data = doc.data();
                notifs.push({ id: doc.id, ...data });
                if (!data.read) unread++;
            });
            setNotifications(notifs);
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const addNotification = useCallback(async (userId, notification) => {
        if (!userId) return; // Don't send notification to nobody
        if (userId === currentUser?.uid) return; // Don't notify yourself
        
        try {
            await addDoc(collection(db, 'notifications'), {
                ...notification,
                userId,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error adding notification:', error);
        }
    }, [currentUser]);

    const markAsRead = useCallback(async (notificationId) => {
        try {
            const ref = doc(db, 'notifications', notificationId);
            await updateDoc(ref, { read: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        const unreadNotifs = notifications.filter(n => !n.read);
        for (const n of unreadNotifs) {
            try {
                await updateDoc(doc(db, 'notifications', n.id), { read: true });
            } catch (error) {
                console.error('Error marking as read:', error);
            }
        }
    }, [notifications]);

    const value = {
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}
