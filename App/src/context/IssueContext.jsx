import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, storage, functions } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp,
    getDoc,
    setDoc,
    where,
    getDocs
} from 'firebase/firestore';

const IssueContext = createContext(null);

const incrementUserPoints = async (userId, amount) => {
    if (!userId || userId === 'system') return;
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().points || 0;
            await updateDoc(userRef, {
                points: currentPoints + amount
            });
        }
    } catch (err) {
        console.error("Error incrementing user points:", err);
    }
};

export const CATEGORIES = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'roads', label: 'Roads', icon: 'road' },
    { id: 'water', label: 'Water', icon: 'water_drop' },
    { id: 'electricity', label: 'Electricity', icon: 'bolt' },
    { id: 'sanitation', label: 'Sanitation', icon: 'delete' },
    { id: 'parks', label: 'Parks', icon: 'park' },
    { id: 'lighting', label: 'Lighting', icon: 'light_mode' },
    { id: 'other', label: 'Other', icon: 'more_horiz' },
];


export function IssueProvider({ children }) {
    const [issues, setIssues] = useState([]);
    const [tempIssues, setTempIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalPosts, setGlobalPosts] = useState([]);
    const [issueMessages, setIssueMessages] = useState({});
    const [backgroundTasks, setBackgroundTasks] = useState([]);

    // Listen to Issues
    useEffect(() => {
        const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
            }));
            setIssues(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Listen to Global Posts
    useEffect(() => {
        const q = query(collection(db, 'global_posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
            }));
            setGlobalPosts(data);
        });
        return unsubscribe;
    }, []);

    const upvoteIssue = useCallback(async (issueId, userId) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (issueDoc.exists()) {
                const issueData = issueDoc.data();
                const upvoterIds = issueData.upvoterIds || [];
                const everUpvoterIds = issueData.everUpvoterIds || [];
                const hasUpvoted = upvoterIds.includes(userId);
                const hasEverUpvoted = everUpvoterIds.includes(userId);

                const newUpvoterIds = hasUpvoted
                    ? upvoterIds.filter(id => id !== userId)
                    : [...upvoterIds, userId];

                const newEverUpvoterIds = hasEverUpvoted
                    ? everUpvoterIds
                    : [...everUpvoterIds, userId];

                await updateDoc(issueRef, {
                    upvotes: newUpvoterIds.length,
                    upvoterIds: newUpvoterIds,
                    everUpvoterIds: newEverUpvoterIds
                });

                // Give voter 2 points if upvoting for the very first time
                if (!hasUpvoted && !hasEverUpvoted && userId) {
                    await incrementUserPoints(userId, 2);
                }

                // Give reporter 10 points when upvotes reach 5 (if not already awarded)
                if (!hasUpvoted && newUpvoterIds.length >= 5 && !issueData.reportingPointsAwarded && issueData.reporterId) {
                    await incrementUserPoints(issueData.reporterId, 10);
                    await updateDoc(issueRef, {
                        reportingPointsAwarded: true
                    });
                }

                // Create notification if it's a new upvote and not the author's own issue
                if (!hasUpvoted && issueData.reporterId && issueData.reporterId !== userId) {
                    try {
                        // Assuming you have currentUser's name somewhere, but IssueContext might not.
                        // We'll just say "Someone" upvoted, or we can fetch the user's name if we have it.
                        // For now we'll say "Someone".
                        await addDoc(collection(db, 'notifications'), {
                            userId: issueData.reporterId,
                            type: 'upvote',
                            icon: 'thumb_up',
                            color: '#4991ff',
                            title: 'Your report was upvoted',
                            body: `Someone upvoted: "${issueData.title}"`,
                            read: false,
                            createdAt: serverTimestamp(),
                            relatedIssueId: issueId
                        });
                    } catch (e) {
                        console.error('Error creating notification:', e);
                    }
                }
            }
        } catch (error) {
            console.error("Error upvoting issue:", error);
        }
    }, []);

    const addIssue = useCallback(async (issue) => {
        const issueData = {
            ...issue,
            upvotes: 0,
            upvoterIds: [],
            status: 'open',
            createdAt: serverTimestamp(),
            commentCount: 0,
            reportingPointsAwarded: false,
        };
        const docRef = await addDoc(collection(db, 'issues'), issueData);

        // Notify everyone in the community/society
        if (issueData.societyId) {
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('societyId', '==', issueData.societyId)
                );
                const querySnapshot = await getDocs(usersQuery);
                const notificationPromises = [];

                const category = CATEGORIES.find(c => c.id === issueData.category);
                const notifIcon = category?.icon || 'campaign';

                querySnapshot.forEach((userDoc) => {
                    const memberData = userDoc.data();
                    // Don't notify the reporter themselves
                    if (memberData.uid && memberData.uid !== issueData.reporterId) {
                        notificationPromises.push(
                            addDoc(collection(db, 'notifications'), {
                                userId: memberData.uid,
                                type: 'new_report',
                                icon: notifIcon,
                                color: '#4991ff',
                                title: 'New Report in Community',
                                body: `${issueData.reporterName || 'A neighbor'} reported: "${issueData.title}"`,
                                read: false,
                                createdAt: serverTimestamp(),
                                relatedIssueId: docRef.id
                            })
                        );
                    }
                });

                if (notificationPromises.length > 0) {
                    await Promise.all(notificationPromises);
                }
            } catch (err) {
                console.error("Error creating community notifications on issue upload:", err);
            }
        }

        return docRef.id;
    }, []);

    // Dynamic listener for issue-specific chats
    const getIssueMessages = useCallback((issueId) => {
        if (!issueMessages[issueId]) {
            const q = query(collection(db, `issues/${issueId}/messages`), orderBy('createdAt', 'asc'));
            onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
                }));
                setIssueMessages(prev => ({ ...prev, [issueId]: data }));
            });
        }
        return issueMessages[issueId] || [];
    }, [issueMessages]);

    const createGlobalPost = useCallback(async (title, description, author, files = []) => {
        if (!author) return;
        const postRef = doc(collection(db, 'global_posts'));
        const postId = postRef.id;
        
        const imageURLs = [];
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const storageRef = ref(storage, `global_posts/${postId}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                imageURLs.push(downloadURL);
            }
        }
        
        await setDoc(postRef, {
            title,
            description,
            imageURLs,
            authorId: author.uid,
            authorName: author.displayName || author.display_name || 'Anonymous',
            authorPhoto: author.photoURL || '',
            createdAt: serverTimestamp(),
            upvotes: [],
            commentCount: 0
        });
        
        await incrementUserPoints(author.uid, 5);
    }, []);

    const upvoteGlobalPost = useCallback(async (postId, userId) => {
        if (!userId) return;
        try {
            const postRef = doc(db, 'global_posts', postId);
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                const currentUpvotes = postSnap.data().upvotes || [];
                const updatedUpvotes = currentUpvotes.includes(userId)
                    ? currentUpvotes.filter(uid => uid !== userId)
                    : [...currentUpvotes, userId];
                
                await updateDoc(postRef, {
                    upvotes: updatedUpvotes
                });
            }
        } catch (err) {
            console.error("Error upvoting post:", err);
        }
    }, []);

    const addGlobalComment = useCallback(async (postId, commentText, author, parentId = null) => {
        if (!author) return;
        const commentRef = collection(db, `global_posts/${postId}/comments`);
        await addDoc(commentRef, {
            text: commentText,
            authorId: author.uid,
            authorName: author.displayName || author.display_name || 'Anonymous',
            authorPhoto: author.photoURL || '',
            createdAt: serverTimestamp(),
            parentId: parentId
        });
        
        const postRef = doc(db, 'global_posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
            const currentCount = postSnap.data().commentCount || 0;
            await updateDoc(postRef, {
                commentCount: currentCount + 1
            });
        }
        
        await incrementUserPoints(author.uid, 2);
    }, []);

    const sendIssueMessage = useCallback(async (issueId, msg) => {
        await addDoc(collection(db, `issues/${issueId}/messages`), {
            ...msg,
            createdAt: serverTimestamp()
        });

        if (msg.senderId) {
            try {
                const messagesRef = collection(db, `issues/${issueId}/messages`);
                const q = query(messagesRef, where('senderId', '==', msg.senderId));
                const snap = await getDocs(q);
                if (snap.size <= 5) {
                    await incrementUserPoints(msg.senderId, 1);
                }
            } catch (err) {
                console.error("Error checking message points limit:", err);
            }
        }
        
        try {
            // Update comment count
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (issueDoc.exists()) {
                await updateDoc(issueRef, {
                    commentCount: (issueDoc.data().commentCount || 0) + 1
                });
            }
        } catch (error) {
            console.error("Error updating comment count:", error);
        }
    }, []);

    const updateIssueStatus = useCallback(async (issueId, status) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            await updateDoc(issueRef, { status });
        } catch (error) {
            console.error("Error updating status:", error);
        }
    }, []);

    const voteOnIssueStatus = useCallback(async (issueId, userId, targetStatus) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (issueDoc.exists()) {
                const issueData = issueDoc.data();
                const participants = issueData.chatParticipants || [];
                const participantCount = participants.length;

                // Only allow voting if there are at least 10 participants
                if (participantCount < 10) return;

                const openVotes = issueData.openVotes || [];
                const inProgressVotes = issueData.inProgressVotes || [];
                const resolvedVotes = issueData.resolvedVotes || [];

                let hasVotedForThis = false;
                if (targetStatus === 'open' && openVotes.includes(userId)) hasVotedForThis = true;
                if (targetStatus === 'in_progress' && inProgressVotes.includes(userId)) hasVotedForThis = true;
                if (targetStatus === 'resolved' && resolvedVotes.includes(userId)) hasVotedForThis = true;

                let newOpenVotes = openVotes.filter(id => id !== userId);
                let newInProgressVotes = inProgressVotes.filter(id => id !== userId);
                let newResolvedVotes = resolvedVotes.filter(id => id !== userId);

                // Add vote to target
                if (targetStatus === 'open') {
                    if (!openVotes.includes(userId)) newOpenVotes.push(userId);
                } else if (targetStatus === 'in_progress') {
                    if (!inProgressVotes.includes(userId)) newInProgressVotes.push(userId);
                } else if (targetStatus === 'resolved') {
                    if (!resolvedVotes.includes(userId)) newResolvedVotes.push(userId);
                }

                if (!hasVotedForThis && userId) {
                    await incrementUserPoints(userId, 5);
                }

                const updatePayload = {
                    openVotes: newOpenVotes,
                    inProgressVotes: newInProgressVotes,
                    resolvedVotes: newResolvedVotes
                };

                // Threshold is simple majority of participants (or at least 5 if participantCount is 10)
                const threshold = Math.max(5, Math.ceil(participantCount / 2));

                let targetVotesList = [];
                if (targetStatus === 'open') targetVotesList = newOpenVotes;
                else if (targetStatus === 'in_progress') targetVotesList = newInProgressVotes;
                else if (targetStatus === 'resolved') targetVotesList = newResolvedVotes;

                // Check if threshold is reached
                if (targetVotesList.length >= threshold) {
                    updatePayload.status = targetStatus;
                    // Reset all status votes for the next cycles
                    updatePayload.openVotes = [];
                    updatePayload.inProgressVotes = [];
                    updatePayload.resolvedVotes = [];

                    // Send system message
                    let systemMsgText = '';
                    if (targetStatus === 'open') {
                        systemMsgText = '📢 System: The community has voted to reopen this issue! Status is now Open. ⚠️';
                    } else if (targetStatus === 'in_progress') {
                        systemMsgText = '📢 System: The community has voted to start work on this issue! Status is now In Progress. 🛠️';
                    } else if (targetStatus === 'resolved') {
                        systemMsgText = '📢 System: The community has voted that this issue is resolved! Status is now Resolved. 🎉';
                    }

                    await addDoc(collection(db, `issues/${issueId}/messages`), {
                        senderId: 'system',
                        senderName: 'System',
                        senderPhoto: '',
                        text: systemMsgText,
                        createdAt: serverTimestamp()
                    });

                    // Update comment count
                    updatePayload.commentCount = (issueData.commentCount || 0) + 1;
                }

                await updateDoc(issueRef, updatePayload);
            }
        } catch (error) {
            console.error("Error voting on issue status:", error);
        }
    }, []);

    const voteToRefreshIssue = useCallback(async (issueId, userId) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (issueDoc.exists()) {
                const issueData = issueDoc.data();
                const participants = issueData.chatParticipants || [];
                const participantCount = participants.length;

                // At least 10 members
                if (participantCount < 10) return;

                const refreshVotes = issueData.refreshVotes || [];
                if (refreshVotes.includes(userId)) return; // Prevent double voting

                const newRefreshVotes = [...refreshVotes, userId];
                const threshold = Math.ceil(participantCount * 0.4);

                const updatePayload = {
                    refreshVotes: newRefreshVotes
                };

                if (newRefreshVotes.length >= threshold) {
                    updatePayload.createdAt = serverTimestamp();
                    updatePayload.refreshVotes = []; // Reset votes

                    // Send system message
                    await addDoc(collection(db, `issues/${issueId}/messages`), {
                        senderId: 'system',
                        senderName: 'System',
                        senderPhoto: '',
                        text: '📢 System: The community has voted to refresh this issue! The listing is now active again. 🐝',
                        createdAt: serverTimestamp()
                    });

                    // Update comment count
                    updatePayload.commentCount = (issueData.commentCount || 0) + 1;
                }

                await updateDoc(issueRef, updatePayload);
            }
        } catch (error) {
            console.error("Error voting to refresh issue:", error);
        }
    }, []);

    const updateIssueStatusWithPhotos = useCallback(async (issueId, status, files) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (!issueDoc.exists()) return;
            const issueData = issueDoc.data();
            const existingImageURLs = issueData.imageURLs || [];

            const uploadedURLs = [];

            if (files && files.length > 0) {
                for (const file of files) {
                    const compressedFile = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = (event) => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_WIDTH = 1024;
                                const MAX_HEIGHT = 1024;
                                if (width > height) {
                                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                } else {
                                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                                    } else {
                                        resolve(file);
                                    }
                                }, 'image/jpeg', 0.75);
                            };
                            img.onerror = () => resolve(file);
                        };
                        reader.onerror = () => resolve(file);
                    });

                    const fileName = `issues/updates-${issueId}-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
                    const storageRef = ref(storage, fileName);
                    const snapshot = await uploadBytes(storageRef, compressedFile);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    uploadedURLs.push(downloadURL);
                }
            }

            const updatePayload = { status };
            if (uploadedURLs.length > 0) {
                updatePayload.imageURLs = [...existingImageURLs, ...uploadedURLs];
            }

            if (status === 'resolved') {
                const participants = issueData.chatParticipants || [];
                const participantCount = participants.length;

                if (participantCount < 10) {
                    updatePayload.chatClosed = true;
                    updatePayload.resolutionPollActive = false;

                    // Send system message that chat is closed directly
                    await addDoc(collection(db, `issues/${issueId}/messages`), {
                        senderId: 'system',
                        senderName: 'System',
                        senderPhoto: '',
                        text: '🔒 System: The reporter has marked this issue as resolved. Since there are less than 10 members, this chat group is now closed. 🐝',
                        createdAt: serverTimestamp()
                    });
                } else {
                    updatePayload.resolutionPollActive = true;
                    updatePayload.resolutionVotes = [];

                    // Send system message that resolution poll has started
                    await addDoc(collection(db, `issues/${issueId}/messages`), {
                        senderId: 'system',
                        senderName: 'System',
                        senderPhoto: '',
                        text: '📢 System: The reporter has marked this issue as resolved. A community poll has started to confirm this. 🐝',
                        createdAt: serverTimestamp()
                    });
                }
            }

            await updateDoc(issueRef, updatePayload);
        } catch (error) {
            console.error("Error updating status with photos:", error);
            throw error;
        }
    }, []);

    const voteToConfirmResolution = useCallback(async (issueId, userId) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueDoc = await getDoc(issueRef);
            if (issueDoc.exists()) {
                const issueData = issueDoc.data();
                const participants = issueData.chatParticipants || [];
                const participantCount = participants.length;
                
                // 40% threshold
                const threshold = Math.ceil(participantCount * 0.4);
                
                const currentVotes = issueData.resolutionVotes || [];
                if (currentVotes.includes(userId)) return; // Already voted
                
                const newVotes = [...currentVotes, userId];
                const updatePayload = {
                    resolutionVotes: newVotes
                };
                
                // Give voter 5 points
                if (userId) {
                    await incrementUserPoints(userId, 5);
                }
                
                if (newVotes.length >= threshold) {
                    updatePayload.chatClosed = true;
                    updatePayload.resolutionPollActive = false; // Poll finished
                    
                    // Send system message
                    await addDoc(collection(db, `issues/${issueId}/messages`), {
                        senderId: 'system',
                        senderName: 'System',
                        senderPhoto: '',
                        text: '🔒 System: 40% of members have confirmed the resolution. This chat group is now closed. 🐝',
                        createdAt: serverTimestamp()
                    });
                }
                
                await updateDoc(issueRef, updatePayload);
            }
        } catch (error) {
            console.error("Error voting to confirm resolution:", error);
        }
    }, []);

    const editIssue = useCallback(async (issueId, { title, description, landmark, existingImageURLs }, files) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            const uploadedURLs = [];

            if (files && files.length > 0) {
                for (const file of files) {
                    const compressedFile = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = (event) => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_WIDTH = 1024;
                                const MAX_HEIGHT = 1024;
                                if (width > height) {
                                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                } else {
                                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                                    } else {
                                        resolve(file);
                                    }
                                }, 'image/jpeg', 0.75);
                            };
                            img.onerror = () => resolve(file);
                        };
                        reader.onerror = () => resolve(file);
                    });

                    const fileName = `issues/updates-${issueId}-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
                    const storageRef = ref(storage, fileName);
                    const snapshot = await uploadBytes(storageRef, compressedFile);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    uploadedURLs.push(downloadURL);
                }
            }

            const updatePayload = {
                title,
                description,
                landmark,
                imageURLs: [...(existingImageURLs || []), ...uploadedURLs]
            };

            await updateDoc(issueRef, updatePayload);
        } catch (error) {
            console.error("Error editing issue:", error);
            throw error;
        }
    }, []);

    const deleteIssue = useCallback(async (issueId) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            // In a real app we might also delete subcollections, but this is fine for now
            // We use deleteDoc from firebase/firestore, so need to ensure it's imported
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(issueRef);
        } catch (error) {
            console.error("Error deleting issue:", error);
        }
    }, []);

    const refreshIssue = useCallback(async (issueId) => {
        try {
            const issueRef = doc(db, 'issues', issueId);
            await updateDoc(issueRef, {
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error refreshing issue:", error);
            throw error;
        }
    }, []);

    const submitStandardReportInBackground = useCallback(async ({
        title,
        description,
        category,
        location,
        landmark,
        lat,
        lng,
        files,
        videoURL,
        videoFile,
        videoUploadPromise,
        currentUser,
        userProfile
    }) => {
        const taskId = Date.now();
        const tempId = `temp-${taskId}`;

        // 1. Create and add optimistic temporary issue
        const tempIssue = {
            id: tempId,
            title,
            description,
            category,
            location,
            landmark,
            lat,
            lng,
            imageURLs: files.map(file => URL.createObjectURL(file)),
            videoURL: videoFile ? URL.createObjectURL(videoFile) : videoURL,
            reporterId: currentUser.uid,
            reporterName: currentUser.displayName || 'Anonymous',
            reporterPhoto: (currentUser.photoURL && currentUser.photoURL !== 'null' && currentUser.photoURL !== 'undefined') ? currentUser.photoURL : `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=4991ff&color=fff`,
            societyId: userProfile?.societyId || null,
            upvotes: 0,
            upvoterIds: [],
            status: 'open',
            createdAt: new Date().toISOString(),
            commentCount: 0,
            isUploading: true
        };

        setTempIssues(prev => [tempIssue, ...prev]);

        setBackgroundTasks(prev => [...prev, {
            id: taskId,
            status: 'running',
            message: 'Submitting Report... 🐝'
        }]);

        // Background worker
        (async () => {
            try {
                // Await video pre-upload if it is still running
                let finalVideoURL = videoURL;
                if (videoUploadPromise) {
                    finalVideoURL = await videoUploadPromise;
                }

                // Compress and upload images in parallel
                const uploadPromises = files.map(async (file) => {
                    const compressedFile = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = (event) => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_WIDTH = 1024;
                                const MAX_HEIGHT = 1024;
                                if (width > height) {
                                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                } else {
                                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                                    } else {
                                        resolve(file);
                                    }
                                }, 'image/jpeg', 0.75);
                            };
                            img.onerror = () => resolve(file);
                        };
                        reader.onerror = () => resolve(file);
                    });

                    const fileName = `issues/${currentUser.uid}-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
                    const storageRef = ref(storage, fileName);
                    const snapshot = await uploadBytes(storageRef, compressedFile);
                    return await getDownloadURL(snapshot.ref);
                });

                const uploadedURLs = await Promise.all(uploadPromises);

                // Save to Firestore
                await addIssue({
                    title,
                    description,
                    category,
                    location,
                    landmark,
                    lat,
                    lng,
                    imageURLs: uploadedURLs,
                    videoURL: finalVideoURL || null,
                    reporterId: currentUser.uid,
                    reporterName: currentUser.displayName || 'Anonymous',
                    reporterPhoto: (currentUser.photoURL && currentUser.photoURL !== 'null' && currentUser.photoURL !== 'undefined') ? currentUser.photoURL : `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=4991ff&color=fff`,
                    societyId: userProfile?.societyId || null,
                });

                // Update task and remove temporary optimistic issue
                setBackgroundTasks(prev =>
                    prev.map(t => t.id === taskId ? { ...t, status: 'success', message: 'Report submitted successfully! 🐝' } : t)
                );
                setTempIssues(prev => prev.filter(i => i.id !== tempId));

                setTimeout(() => {
                    setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
                }, 4000);

            } catch (err) {
                console.error("Background submission failed:", err);
                setBackgroundTasks(prev =>
                    prev.map(t => t.id === taskId ? { ...t, status: 'error', message: 'Report submission failed. Try again.' } : t)
                );
                // Remove temporary issue on error
                setTempIssues(prev => prev.filter(i => i.id !== tempId));
                
                setTimeout(() => {
                    setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
                }, 5000);
            }
        })();
    }, [addIssue]);

    const submitFlashReport = useCallback(async ({
        files,
        videoFile,
        lat,
        lng,
        location,
        landmark,
        currentUser,
        userProfile
    }) => {
        const taskId = Date.now();
        setBackgroundTasks(prev => [...prev, {
            id: taskId,
            status: 'running',
            message: 'Submitting Flash Report... 🐝⚡'
        }]);

        // Background worker
        (async () => {
            try {
                // 1. Convert files to base64 for Gemini API
                const formattedImages = [];
                for (const file of files) {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    const mimeType = dataUrl.split(';')[0].split(':')[1];
                    const base64Data = dataUrl.split(',')[1];
                    formattedImages.push({ data: base64Data, mimeType });
                }

                // 2. Call AI Cloud Function
                const analyzeMediaFn = httpsCallable(functions, 'analyzeMedia');
                const aiResponse = await analyzeMediaFn({
                    images: formattedImages
                });

                const data = aiResponse.data;
                const title = data.title ? data.title.substring(0, 120) : 'Flash Report';
                const description = data.description ? data.description.substring(0, 1000) : 'Reported using AI Flash Report.';
                
                let category = 'other';
                if (data.category) {
                    let cat = data.category.toLowerCase().trim();
                    if (cat === 'road') cat = 'roads';
                    if (cat === 'park') cat = 'parks';
                    if (cat === 'light' || cat === 'streetlight' || cat === 'streetlights') cat = 'lighting';
                    
                    const validIds = ['roads', 'water', 'electricity', 'sanitation', 'parks', 'lighting', 'other'];
                    if (validIds.includes(cat)) {
                        category = cat;
                    }
                }

                // 3. Compress and Upload Media to Firebase Storage
                const uploadedURLs = [];
                let videoURL = null;

                for (const file of files) {
                    const compressedFile = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = (event) => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_WIDTH = 1024;
                                const MAX_HEIGHT = 1024;
                                if (width > height) {
                                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                } else {
                                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                                    } else {
                                        resolve(file);
                                    }
                                }, 'image/jpeg', 0.75);
                            };
                            img.onerror = () => resolve(file);
                        };
                        reader.onerror = () => resolve(file);
                    });

                    const fileName = `issues/${currentUser.uid}-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
                    const storageRef = ref(storage, fileName);
                    const snapshot = await uploadBytes(storageRef, compressedFile);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    uploadedURLs.push(downloadURL);
                }

                if (videoFile) {
                    const fileName = `issues/videos/${currentUser.uid}-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp4`;
                    const storageRef = ref(storage, fileName);
                    const snapshot = await uploadBytes(storageRef, videoFile);
                    videoURL = await getDownloadURL(snapshot.ref);
                }

                // 4. Save to Firestore
                await addIssue({
                    title,
                    description,
                    category,
                    location: location || 'Captured Location',
                    landmark: landmark || '',
                    lat: lat || 12.9716,
                    lng: lng || 77.5946,
                    imageURLs: uploadedURLs,
                    videoURL: videoURL,
                    reporterId: currentUser.uid,
                    reporterName: currentUser.displayName || 'Anonymous',
                    reporterPhoto: (currentUser.photoURL && currentUser.photoURL !== 'null' && currentUser.photoURL !== 'undefined') ? currentUser.photoURL : `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=4991ff&color=fff`,
                    societyId: userProfile?.societyId || null,
                });

                // Update background task state to success
                setBackgroundTasks(prev =>
                    prev.map(t => t.id === taskId ? { ...t, status: 'success', message: 'Flash Report submitted successfully! 🐝⚡' } : t)
                );
                
                // Clear after 4 seconds
                setTimeout(() => {
                    setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
                }, 4000);

            } catch (err) {
                console.error("Background Flash Report failed:", err);
                setBackgroundTasks(prev =>
                    prev.map(t => t.id === taskId ? { ...t, status: 'error', message: 'Flash Report failed. Try again.' } : t)
                );
                // Clear after 5 seconds
                setTimeout(() => {
                    setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
                }, 5000);
            }
        })();
    }, [addIssue]);

    return (
        <IssueContext.Provider value={{
            issues: [...tempIssues, ...issues],
            loading,
            globalPosts,
            issueMessages,
            backgroundTasks,
            getIssueMessages,
            upvoteIssue,
            addIssue,
            submitFlashReport,
            submitStandardReportInBackground,
            updateIssueStatus,
            updateIssueStatusWithPhotos,
            voteOnIssueStatus,
            voteToRefreshIssue,
            voteToConfirmResolution,
            deleteIssue,
            editIssue,
            refreshIssue,
            createGlobalPost,
            upvoteGlobalPost,
            addGlobalComment,
            sendIssueMessage,
            CATEGORIES,
        }}>
            {children}
        </IssueContext.Provider>
    );
}

export function useIssues() {
    const context = useContext(IssueContext);
    if (!context) throw new Error('useIssues must be used within IssueProvider');
    return context;
}
