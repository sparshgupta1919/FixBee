import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIssues } from '../context/IssueContext';
import { ProfileSkeleton } from '../components/Skeleton';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';

// Modal component for updating status with optional photos
const UpdateStatusModal = ({ isOpen, onClose, issue, onUpdate }) => {
    const [selectedStatus, setSelectedStatus] = useState('in_progress');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && issue) {
            setSelectedFiles([]);
            setPreviewUrls([]);
            setIsSubmitting(false);
            
            // Default to 'in_progress' if open, else 'resolved'
            if (issue.status === 'open') {
                setSelectedStatus('in_progress');
            } else {
                setSelectedStatus('resolved');
            }
        }
    }, [isOpen, issue]);

    if (!isOpen || !issue) return null;

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newPreviews]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setPreviewUrls(prev => {
            URL.revokeObjectURL(prev[indexToRemove]);
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onUpdate(issue.id, selectedStatus, selectedFiles);
            onClose();
        } catch (err) {
            console.error("Failed to update status:", err);
            alert("Error updating status. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isInProgressDisabled = issue.status === 'in_progress' || issue.status === 'resolved';
    const isResolvedDisabled = issue.status === 'resolved';
    
    const displayStatusColor = selectedStatus === 'in_progress' ? '#f59e0b' : '#10B981';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" style={{ zIndex: 100 }}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-slate-100 dark:border-slate-800 animate-slideUp">
                
                {/* Header */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="rounded-full flex items-center justify-center mb-1 bg-blue-500/10" style={{ width: '48px', height: '48px' }}>
                        <span className="material-symbols-outlined font-extrabold text-blue-500" style={{ fontSize: '24px' }}>settings</span>
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-800 dark:text-white font-outfit leading-tight">Update Status</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[85%] truncate-2-lines">
                        Set status for <span className="font-bold text-slate-600 dark:text-slate-300">"{issue.title}"</span>
                    </p>
                </div>

                {/* Option selector */}
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Status</p>
                    <div className="flex gap-2">
                        {/* In Progress option button */}
                        <button
                            type="button"
                            disabled={isInProgressDisabled}
                            onClick={() => setSelectedStatus('in_progress')}
                            className={`flex-1 py-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                                isInProgressDisabled
                                    ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/50 text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : selectedStatus === 'in_progress'
                                    ? 'bg-[#fef3c7] dark:bg-[#fef3c7]/10 text-[#d97706] dark:text-[#fbbf24] border-[#fbbf24] shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>construction</span>
                            <span className="text-[11px] font-extrabold">In Progress</span>
                        </button>

                        {/* Resolved option button */}
                        <button
                            type="button"
                            disabled={isResolvedDisabled}
                            onClick={() => setSelectedStatus('resolved')}
                            className={`flex-1 py-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                                isResolvedDisabled
                                    ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/50 text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : selectedStatus === 'resolved'
                                    ? 'bg-[#dcfce7] dark:bg-[#dcfce7]/10 text-[#16a34a] dark:text-[#4ade80] border-[#4ade80] shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
                            <span className="text-[11px] font-extrabold">Resolved</span>
                        </button>
                    </div>
                </div>

                {/* Upload Photos Section */}
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Add photos (Optional)</p>
                    
                    {/* Preview list */}
                    {previewUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 max-h-[70px] no-scrollbar">
                            {previewUrls.map((url, idx) => (
                                <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => handleRemoveFile(idx)}
                                        className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-500 flex items-center justify-center text-white"
                                        style={{ fontSize: '10px' }}
                                    >
                                        <span className="material-symbols-outlined text-[10px]" style={{ fontWeight: 800 }}>close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Drag / Select container */}
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '24px' }}>add_a_photo</span>
                        <span className="text-[11px] font-bold text-slate-500 mt-1">Upload Photo</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isSubmitting}
                        />
                    </label>
                </div>

                {/* Submit actions */}
                <div className="flex gap-3 mt-2">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (isInProgressDisabled && isResolvedDisabled)}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                        style={{ backgroundColor: displayStatusColor }}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                <span>Updating...</span>
                            </>
                        ) : (
                            <span>Confirm Status</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Custom Delete Confirmation Modal
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[4px]">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-xs flex flex-col gap-4 shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-scaleUp">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="rounded-full flex items-center justify-center bg-red-500/10 text-red-500 mb-1" style={{ width: '48px', height: '48px' }}>
                        <span className="material-symbols-outlined font-extrabold" style={{ fontSize: '24px' }}>warning</span>
                    </div>
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white font-outfit">Delete Report?</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                        Are you sure you want to delete <span className="font-bold text-slate-600 dark:text-slate-300">"{title}"</span>? This action cannot be undone.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-red-500 hover:bg-red-600 shadow-sm transition-all active:scale-95"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

// Modal component for editing issue details (title, description, landmark, images)
const EditIssueModal = ({ isOpen, onClose, issue, onUpdate, onDelete }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [landmark, setLandmark] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [existingImageURLs, setExistingImageURLs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (isOpen && issue) {
            setTitle(issue.title || '');
            setDescription(issue.description || '');
            setLandmark(issue.landmark || '');
            setSelectedFiles([]);
            setPreviewUrls([]);
            setExistingImageURLs(issue.imageURLs || []);
            setIsSubmitting(false);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, issue]);

    // Clean up preview URLs on unmount/change
    useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    if (!isOpen || !issue) return null;

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newPreviews]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setPreviewUrls(prev => {
            URL.revokeObjectURL(prev[indexToRemove]);
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
    };

    const handleRemoveExistingImage = (urlToRemove) => {
        setExistingImageURLs(prev => prev.filter(url => url !== urlToRemove));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert("Title is required.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onUpdate(issue.id, {
                title: title.trim(),
                description: description.trim(),
                landmark: landmark.trim(),
                existingImageURLs
            }, selectedFiles);
            onClose();
        } catch (err) {
            console.error("Failed to edit report:", err);
            alert("Failed to save changes. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setIsSubmitting(true);
        setShowDeleteConfirm(false);
        try {
            await onDelete(issue.id);
            onClose();
        } catch (err) {
            console.error("Failed to delete report:", err);
            alert("Failed to delete report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" style={{ zIndex: 100 }}>
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl border border-slate-100 dark:border-slate-800 animate-slideUp max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-lg text-slate-800 dark:text-white font-outfit">Edit Report</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Form fields */}
                    <div className="flex flex-col gap-3.5">
                        {/* Title */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm focus:outline-none focus:border-[#4991ff] text-slate-800 dark:text-white font-medium"
                                placeholder="Enter issue title"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm focus:outline-none focus:border-[#4991ff] text-slate-800 dark:text-white font-medium resize-none"
                                placeholder="Enter details about the issue"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Landmark */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Landmark</label>
                            <input
                                type="text"
                                value={landmark}
                                onChange={e => setLandmark(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm focus:outline-none focus:border-[#4991ff] text-slate-800 dark:text-white font-medium"
                                placeholder="e.g. Near main gate"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Existing Images */}
                        {existingImageURLs.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current Photos</label>
                                <div className="flex gap-2 overflow-x-auto pb-1 max-h-[70px] no-scrollbar">
                                    {existingImageURLs.map((url, idx) => (
                                        <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveExistingImage(url)}
                                                className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm"
                                                style={{ fontSize: '10px' }}
                                            >
                                                <span className="material-symbols-outlined text-[10px]" style={{ fontWeight: 800 }}>close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upload New Photos */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Add Photos</label>
                            {previewUrls.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 max-h-[70px] no-scrollbar">
                                    {previewUrls.map((url, idx) => (
                                        <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(idx)}
                                                className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm"
                                                style={{ fontSize: '10px' }}
                                            >
                                                <span className="material-symbols-outlined text-[10px]" style={{ fontWeight: 800 }}>close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '20px' }}>add_a_photo</span>
                                <span className="text-[10px] font-bold text-slate-500 mt-0.5">Upload Photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    disabled={isSubmitting}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 py-3 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSubmitting || !title.trim()}
                                className="flex-1 py-3 rounded-2xl font-bold text-xs text-white bg-[#4991ff] hover:bg-blue-600 shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>Save Changes</span>
                                )}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isSubmitting}
                            className="w-full py-3 rounded-2xl font-bold text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center gap-1.5 transition-colors mt-1"
                        >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Delete Report
                        </button>
                    </div>
                </div>
            </div>

            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteConfirm}
                title={title}
            />
        </>
    );
};

// Modal component for editing profile (displayName + photoURL)
const EditProfileModal = ({ isOpen, onClose, currentUser, userProfile }) => {
    const [displayName, setDisplayName] = useState('');
    const [previewPhoto, setPreviewPhoto] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && currentUser) {
            const currentName = userProfile?.displayName || userProfile?.display_name || currentUser.displayName || '';
            const currentPhoto = userProfile?.photoURL || currentUser.photoURL || '';
            setDisplayName(currentName);
            setPreviewPhoto(currentPhoto && currentPhoto !== 'null' && currentPhoto !== 'undefined' ? currentPhoto : '');
            setSelectedFile(null);
            setIsSubmitting(false);
        }
    }, [isOpen, currentUser, userProfile]);

    if (!isOpen || !currentUser) return null;

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewPhoto(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async () => {
        if (!currentUser) return;
        setIsSubmitting(true);
        try {
            let newPhotoURL = userProfile?.photoURL || currentUser.photoURL || '';
            if (newPhotoURL === 'null' || newPhotoURL === 'undefined') {
                newPhotoURL = '';
            }
            
            if (selectedFile) {
                const fileExtension = selectedFile.name.split('.').pop() || 'jpg';
                const storageRef = ref(storage, `profiles/${currentUser.uid}-${Date.now()}.${fileExtension}`);
                const snapshot = await uploadBytes(storageRef, selectedFile);
                newPhotoURL = await getDownloadURL(snapshot.ref);
            }
            
            // 1. Update Firebase Auth Profile
            await updateProfile(currentUser, {
                displayName: displayName.trim(),
                photoURL: newPhotoURL
            });
            
            // 2. Update Firestore User Profile
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                displayName: displayName.trim(),
                display_name: displayName.trim(),
                photoURL: newPhotoURL
            });
            
            onClose();
        } catch (err) {
            console.error("Error updating profile:", err);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-scaleIn flex flex-col items-center">
                <h3 className="text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-5 font-outfit">Edit Profile</h3>
                
                <div className="relative mb-6">
                    <div className="p-1 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        {previewPhoto ? (
                            <img 
                                src={previewPhoto} 
                                alt="Preview" 
                                className="w-[100px] h-[100px] rounded-full object-cover" 
                            />
                        ) : (
                            <div className="w-[100px] h-[100px] rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold font-outfit">
                                {displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'FB'}
                            </div>
                        )}
                    </div>
                    <label 
                        htmlFor="edit-profile-photo-input" 
                        className="absolute bottom-0 right-0 w-8 h-8 bg-[#4991ff] hover:bg-blue-600 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-md cursor-pointer transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>
                    </label>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                        className="hidden" 
                        id="edit-profile-photo-input" 
                    />
                </div>

                <div className="w-full mb-6">
                    <label className="block text-[10px] font-bold tracking-[0.1em] text-slate-400 dark:text-slate-500 uppercase mb-2">
                        DISPLAY NAME
                    </label>
                    <input 
                        type="text" 
                        value={displayName} 
                        onChange={e => setDisplayName(e.target.value)} 
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm focus:outline-none focus:border-[#4991ff] dark:focus:border-[#4991ff] transition-all text-slate-800 dark:text-white font-medium"
                        placeholder="Enter display name"
                    />
                </div>

                <div className="flex w-full gap-3">
                    <button 
                        onClick={onClose} 
                        disabled={isSubmitting} 
                        className="flex-1 py-3 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !displayName.trim()} 
                        className="flex-1 py-3 rounded-2xl font-bold text-xs text-white bg-[#4991ff] hover:bg-blue-600 shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>Save Changes</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Help & Support Modal containing contact support, privacy policy and user agreement
const HelpSupportModal = ({ isOpen, onClose }) => {
    const [subView, setSubView] = useState(null); // 'privacy' | 'terms' | null

    if (!isOpen) return null;

    return (
        <div onClick={onClose} className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-xl border border-slate-100 dark:border-slate-800 animate-scaleIn flex flex-col">
                
                {subView === null ? (
                    <>
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#4991ff]" style={{ fontSize: '24px' }}>help_outline</span>
                                <h3 className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Help & Support</h3>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <a 
                                href="mailto:sparshgupta1919@gmail.com"
                                className="w-full p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all text-left"
                            >
                                <span className="material-symbols-outlined text-[#4991ff]" style={{ fontSize: '22px' }}>mail_outline</span>
                                <span className="text-sm font-semibold text-[#4991ff]">Contact Support</span>
                            </a>

                            <button 
                                onClick={() => setSubView('privacy')}
                                className="w-full p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-800/30 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '22px' }}>policy</span>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Privacy Policy</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 dark:text-slate-600" style={{ fontSize: '18px' }}>chevron_right</span>
                            </button>

                            <button 
                                onClick={() => setSubView('terms')}
                                className="w-full p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-800/30 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '22px' }}>gavel</span>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Terms of Service</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 dark:text-slate-600" style={{ fontSize: '18px' }}>chevron_right</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <button onClick={() => setSubView(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                            </button>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {subView === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                            </h3>
                        </div>
                        <div className="overflow-y-auto max-h-[300px] text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-1 flex flex-col gap-3">
                            {subView === 'privacy' ? (
                                <>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">1. Data We Collect</p>
                                    <p>We collect your basic profile details (display name, email address, profile picture) during registration to facilitate community interactions. We also process reports, location coordinate details of issue submissions, upvotes, and in-app community chat logs.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">2. How We Use Data</p>
                                    <p>Your data is used solely to verify location coordinates, assign reports to your local community group chat, display issues on maps, send notifications of new messages, and maintain platform security.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">3. Data Sharing</p>
                                    <p>FixBee does not sell, lease, or rent your personal data to third parties. Verified local civic coordinates and active community reports are shared dynamically with neighbors inside your selected society boundary to facilitate group coordination.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">4. Contact Information</p>
                                    <p>For support or data retention inquiries, reach out to support at sparshgupta1919@gmail.com.</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">1. Terms Acceptance</p>
                                    <p>By using FixBee, you agree to these Terms of Service. If you do not agree, please do not use the application.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">2. Code of Conduct</p>
                                    <p>You agree to only report genuine issues with accurate geolocation coordinates and real photos. Spamming, posting offensive material, harassing community members in chats, or providing fraudulent information is strictly prohibited and will lead to account suspension.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">3. Platform Services Limitation</p>
                                    <p>FixBee serves purely as an intermediary community-coordination dashboard. We are not responsible or liable for any civic resolutions, neighborhood interactions, or physical outcomes resulting from reported content.</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">4. Accounts & Security</p>
                                    <p>You must keep your account secure. Unauthorized account use should be reported immediately to support.</p>
                                </>
                            )}
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

const getCitizenTag = (points) => {
    if (points >= 500) return 'Civic Legend 👑';
    if (points >= 300) return 'Neighborhood Champion';
    if (points >= 150) return 'Local Hero';
    if (points >= 50) return 'Community Guardian';
    return 'Active Citizen';
};

export default function ProfilePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { defaultTab } = location.state || {};
    const { currentUser, userProfile, signOut } = useAuth();
    const { issues, loading, updateIssueStatusWithPhotos, refreshIssue, deleteIssue, editIssue } = useIssues();
    const isAdmin = userProfile?.role === 'admin' || currentUser?.role === 'admin';

    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);

    const [activeTab, setActiveTab] = useState(defaultTab || 'unresolved');
    const [imageError, setImageError] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    // Edit Issue modal states
    const [isEditIssueModalOpen, setIsEditIssueModalOpen] = useState(false);
    const [editIssueModalIssue, setEditIssueModalIssue] = useState(null);

    const handleEditClick = (issue) => {
        setEditIssueModalIssue(issue);
        setIsEditIssueModalOpen(true);
    };

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);
    
    // Status update modal states
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusModalIssue, setStatusModalIssue] = useState(null);

    const handleStatusClick = (issue) => {
        setStatusModalIssue(issue);
        setIsStatusModalOpen(true);
    };

    const handleRefreshClick = async (issue) => {
        try {
            await refreshIssue(issue.id);
        } catch (err) {
            console.error("Failed to refresh report:", err);
            alert("Failed to refresh report. Please try again.");
        }
    };

    const handleDeleteClick = async (issueId) => {
        if (window.confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
            try {
                await deleteIssue(issueId);
            } catch (err) {
                console.error("Failed to delete report:", err);
                alert("Failed to delete report. Please try again.");
            }
        }
    };

    const myIssues = issues.filter((i) => i.reporterId === currentUser?.uid);
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const isRecent = (dateStr) => new Date(dateStr).getTime() > tenDaysAgo;

    const activeUnresolvedCount = myIssues.filter((i) => isRecent(i.createdAt) && (i.status === 'open' || i.status === 'in_progress')).length;
    const activeResolvedCount = myIssues.filter((i) => isRecent(i.createdAt) && i.status === 'resolved').length;
    const points = userProfile?.points ?? 0;
    const given = userProfile?.upvotesGiven ?? 0;

    const filteredIssues = myIssues.filter(i => {
        const active = isRecent(i.createdAt);
        if (activeTab === 'inactive') return !active;
        
        // For other tabs, only show active reports
        if (!active) return false;
        
        if (activeTab === 'unresolved') return i.status === 'open' || i.status === 'in_progress';
        if (activeTab === 'resolved') return i.status === 'resolved';
        return true;
    });

    const handleSignOut = async () => {
        try { await signOut(); navigate('/'); } catch (e) { console.error(e); }
    };

    const displayNameToUse = userProfile?.displayName || userProfile?.display_name || currentUser?.displayName || 'Community Member';
    const photoURLToUse = userProfile?.photoURL || currentUser?.photoURL || '';

    const initials = displayNameToUse
        ? displayNameToUse.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        : 'FB';

    if (loading) {
        return <ProfileSkeleton />;
    }

    return (
        <div 
            className="flex flex-col h-[100dvh] has-bottom-nav overflow-hidden"
            style={{ background: 'var(--chat-list-bg)' }}
        >
            <header 
                className="sticky top-0 z-30 flex-shrink-0 border-b border-slate-200/50 dark:border-slate-800/80 backdrop-blur-xl"
                style={{ paddingTop: 'var(--safe-area-top)', background: 'var(--header-bg)' }}
            >
                <div className="flex items-center justify-between px-4 py-4 max-w-lg mx-auto">
                    <h1 className="text-[22px] font-medium text-[#0d1b12] dark:text-white tracking-tight">Profile</h1>
                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                        <button onClick={() => setIsDark((d) => !d)} className="transition-transform active:scale-90 flex items-center justify-center p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                                {isDark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                        <div className="relative">
                            <button onClick={() => setShowMenu(prev => !prev)} className="transition-transform active:scale-90 flex items-center justify-center p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                <span className="material-symbols-outlined text-slate-600 dark:text-slate-300" style={{ fontSize: '24px' }}>more_vert</span>
                            </button>
                            
                            {showMenu && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setShowMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 rounded-2xl shadow-lg z-50 py-2 animate-fadeIn">
                                        {isAdmin && (
                                            <button 
                                                onClick={() => {
                                                    setShowMenu(false);
                                                    navigate('/admin');
                                                }}
                                                className="w-full text-left px-[18px] py-[11px] text-sm font-bold flex items-center gap-3 transition-colors"
                                                style={{ color: '#8b5cf6' }}
                                            >
                                                <span className="material-symbols-outlined text-[18px]" style={{ color: '#8b5cf6' }}>admin_panel_settings</span>
                                                <span>Admin Dashboard</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setShowMenu(false);
                                                navigate('/onboarding', { state: { forceStep: 1 } });
                                            }}
                                            className="w-full text-left px-[18px] py-[11px] text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">location_on</span>
                                            <span>Change Community</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setShowMenu(false);
                                                setIsHelpModalOpen(true);
                                            }}
                                            className="w-full text-left px-[18px] py-[11px] text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">help_outline</span>
                                            <span>Help & Support</span>
                                        </button>
                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                        <button 
                                            onClick={() => {
                                                setShowMenu(false);
                                                handleSignOut();
                                            }}
                                            className="w-full text-left px-[18px] py-[11px] text-sm font-bold text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 flex items-center gap-3 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">logout</span>
                                            <span>Log Out</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide w-full max-w-lg mx-auto px-4 pb-8 flex flex-col items-center">
                {/* Avatar */}
                <div className="relative mt-2 mb-4">
                    <div className="p-1 rounded-full border-2 border-slate-200 dark:border-slate-700/50 bg-white dark:bg-surface-dark">
                        {photoURLToUse && photoURLToUse !== 'null' && photoURLToUse !== 'undefined' && !imageError ? (
                            <img 
                                src={photoURLToUse} 
                                alt="User" 
                                className="w-[100px] h-[100px] rounded-full object-cover" 
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="w-[100px] h-[100px] rounded-full bg-primary flex items-center justify-center">
                                <span className="text-3xl font-bold text-white font-outfit">{initials}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setIsEditModalOpen(true)} className="absolute bottom-0 right-0 w-9 h-9 bg-[#FDC938] rounded-full flex items-center justify-center text-[#022054] border-[3px] border-[#f8f9fa] dark:border-background-dark shadow-sm hover:bg-yellow-500 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </button>
                </div>

                {/* Name */}
                <h2 className="text-[24px] font-normal text-[#0d1b12] dark:text-white font-outfit">{displayNameToUse}</h2>

                {/* Info Pill */}
                <div className="mt-3 bg-white dark:bg-surface-dark px-5 py-2.5 rounded-[100px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <img 
                        src="data:image/svg+xml,%3csvg%20width='86'%20height='92'%20viewBox='0%200%2086%2092'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M62.3333%2043.5417L54.5417%2029.7917L62.3333%2016.0417H77.6875L85.4792%2029.7917L77.6875%2043.5417H62.3333V43.5417M35.0625%2059.5833L27.2708%2045.8333L35.0625%2032.0833H50.4167L58.2083%2045.8333L50.4167%2059.5833H35.0625V59.5833M35.0625%2027.5L27.2708%2013.75L35.0625%200H50.4167L58.2083%2013.75L50.4167%2027.5H35.0625V27.5M7.79167%2043.5417L0%2029.7917L7.79167%2016.0417H23.1458L30.5938%2029.7917L23.1458%2043.5417H7.79167V43.5417M7.79167%2075.625L0%2061.875L7.79167%2048.125H23.1458L30.5938%2061.875L23.1458%2075.625H7.79167V75.625M35.5208%2091.6667L27.2708%2077.9167L35.0625%2064.1667H50.4167L58.2083%2077.9167L50.4167%2091.6667H35.5208V91.6667M62.3333%2075.625L54.5417%2061.875L62.3333%2048.125H77.6875L85.4792%2061.875L77.6875%2075.625H62.3333V75.625'%20fill='%23FACC15'/%3e%3c/svg%3e" 
                        alt="Honeycomb" 
                        className="w-[18px] h-[19.25px] flex-shrink-0"
                    />
                    <span className="text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                        {points.toLocaleString()} Bee Points, {getCitizenTag(points)}
                    </span>
                </div>

                {/* Stat Cards */}
                <div className="w-full flex gap-3 mt-8">
                    <div className="flex-1 bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[24px] font-bold text-[#0d1b12] dark:text-white leading-none font-outfit">{activeUnresolvedCount}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 tracking-[0.1em]">UNRESOLVED</span>
                    </div>
                    <div className="flex-1 bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[24px] font-bold text-[#0d1b12] dark:text-white leading-none font-outfit">{given}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 tracking-[0.1em]">UPVOTES</span>
                    </div>
                    <div className="flex-1 bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[24px] font-bold text-[#0d1b12] dark:text-white leading-none font-outfit">{activeResolvedCount}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 tracking-[0.1em]">RESOLVED</span>
                    </div>
                </div>

                {/* Title */}
                <div className="w-full mt-8 mb-4">
                    <h3 className="text-[19px] font-medium text-[#0d1b12] dark:text-white font-outfit">My Reports</h3>
                </div>

                {/* Tabs */}
                <div className="w-full bg-[#f1f3f5] dark:bg-slate-800/60 p-1.5 rounded-[18px] flex">
                    {['unresolved', 'inactive', 'resolved'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                            className={`flex-1 py-2.5 rounded-[14px] text-[13px] font-bold transition-all ${activeTab === t ? 'bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#0d1b12] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            {t === 'unresolved' ? 'Unresolved' : t === 'inactive' ? 'Inactive' : 'Resolved'}
                        </button>
                    ))}
                </div>

                {/* Grid of issues */}
                {filteredIssues.length > 0 ? (
                    <div className="w-full mt-6 grid grid-cols-2 gap-3.5">
                        {filteredIssues.map(issue => (
                            <div key={issue.id} className="bg-white dark:bg-surface-dark rounded-3xl overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col">
                                {/* Image area */}
                                <div 
                                    onClick={() => navigate(`/issue/${issue.id}`)}
                                    className="h-[150px] relative bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-95 transition-opacity"
                                >
                                    {issue.imageURLs?.[0] ? (
                                        <img src={issue.imageURLs[0]} className="w-full h-full object-cover" alt="Issue" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '40px' }}>image</span>
                                        </div>
                                    )}
                                    <div className={`absolute top-3 right-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm ${!isRecent(issue.createdAt) ? 'bg-slate-500' : 'bg-[#4991ff]'}`}>
                                        {!isRecent(issue.createdAt) ? 'inactive' : issue.status}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditClick(issue);
                                        }}
                                        className="absolute bottom-3 right-3 w-8 h-8 bg-white dark:bg-surface-dark rounded-full shadow-md flex items-center justify-center text-[#FDC938] hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                                    </button>
                                </div>
                                {/* Content area */}
                                <div className="p-3.5">
                                    <p className="text-[13px] font-bold text-[#0d1b12] dark:text-white line-clamp-1 mb-1">{issue.title}</p>
                                    <p className="text-[15px] font-bold text-[#4991ff] font-outfit mb-3">{issue.upvotes} <span className="text-[12px] opacity-80">Upvotes</span></p>
                                    
                                    {!isRecent(issue.createdAt) ? (
                                        <button
                                            onClick={() => handleRefreshClick(issue)}
                                            className="w-full py-2.5 rounded-[12px] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-sm bg-amber-500 hover:bg-amber-600 text-white"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                                            Refresh
                                        </button>
                                    ) : (
                                        <button
                                            disabled={issue.status === 'resolved'}
                                            onClick={() => handleStatusClick(issue)}
                                            className={`w-full py-2.5 rounded-[12px] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-sm ${
                                                issue.status === 'resolved'
                                                    ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                    : 'bg-[#4991ff] hover:bg-blue-600 text-white'
                                            }`}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M0 0h24v24H0z" fill="none" />
                                                <path fill="currentColor" d="M16.5 11L13 7.5l1.4-1.4l2.1 2.1L20.7 4l1.4 1.4zM11 7H2v2h9zm10 6.4L19.6 12L17 14.6L14.4 12L13 13.4l2.6 2.6l-2.6 2.6l1.4 1.4l2.6-2.6l2.6 2.6l1.4-1.4l-2.6-2.6zM11 15H2v2h9z" />
                                            </svg>
                                            Status
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 font-display text-center animate-fadeIn w-full">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center border border-slate-200/20 shadow-inner">
                            <span className="material-symbols-outlined text-[36px] text-slate-400 dark:text-slate-500">inventory_2</span>
                        </div>
                        <h3 className="font-extrabold text-base text-slate-800 dark:text-white mt-5">No reports found</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mt-2 leading-relaxed">
                            {activeTab === 'unresolved' 
                                ? "You don't have any active unresolved reports." 
                                : activeTab === 'resolved' 
                                ? "You don't have any resolved reports." 
                                : "You don't have any inactive reports."}
                        </p>
                        <button
                            onClick={() => navigate('/report')}
                            className="btn-primary mt-6 px-8 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-primary/20 hover:-translate-y-[1px] active:translate-y-[1px] transition-all"
                        >
                            Report an Issue
                        </button>
                    </div>
                )}
            </div>

            {/* Status Update Modal */}
            <UpdateStatusModal
                isOpen={isStatusModalOpen}
                onClose={() => setIsStatusModalOpen(false)}
                issue={statusModalIssue}
                onUpdate={updateIssueStatusWithPhotos}
            />

            {/* Edit Profile Modal */}
            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                currentUser={currentUser}
                userProfile={userProfile}
            />

            {/* Edit Issue Modal */}
            <EditIssueModal
                isOpen={isEditIssueModalOpen}
                onClose={() => setIsEditIssueModalOpen(false)}
                issue={editIssueModalIssue}
                onUpdate={editIssue}
                onDelete={deleteIssue}
            />

            {/* Help & Support Modal */}
            <HelpSupportModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />
        </div>
    );
}