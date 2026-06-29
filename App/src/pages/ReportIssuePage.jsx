import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import Toast from '../components/Toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet default marker icon (Vite build issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Map events handler to allow placing marker on click
const MapEventsHandler = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

// Map center setter to programmatically recenter/zoom when coords change
const RecenterMap = ({ center }) => {
    const map = useMapEvents({});
    useEffect(() => {
        if (center?.[0] && center?.[1]) {
            map.setView(center, 16);
        }
    }, [center, map]);
    return null;
};

const CATEGORY_COLORS = {
    roads: { color: '#78350f', bg: 'rgba(120,53,15,0.08)' },       // Asphalt Brown
    water: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },       // Sky Blue
    electricity: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' }, // Amber
    sanitation: { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },  // Slate
    parks: { color: '#10b981', bg: 'rgba(16,185,129,0.08)' },       // Emerald
    lighting: { color: '#eab308', bg: 'rgba(234,179,8,0.08)' },      // Yellow
    other: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },       // Violet
};

const getCategoryStyles = (catId, isSelected) => {
    const config = CATEGORY_COLORS[catId] || { color: '#4991ff', bg: 'rgba(73,145,255,0.08)' };
    if (isSelected) {
        return {
            background: config.bg,
            border: `1.5px solid ${config.color}`,
            color: config.color,
            iconColor: config.color,
        };
    } else {
        return {
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-secondary)',
            iconColor: config.color,
        };
    }
};

const ReportIssuePage = () => {
    const navigate = useNavigate();
    const { addIssue, submitFlashReport, submitStandardReportInBackground } = useIssues();
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const fileInputRef = useRef(null);
    const videoInputRef = useRef(null);

    const [videoPreview, setVideoPreview] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [videoURL, setVideoURL] = useState(null);
    const [isVideoUploading, setIsVideoUploading] = useState(false);
    const videoUploadPromiseRef = useRef(null);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [landmark, setLandmark] = useState('');
    const [images, setImages] = useState([]); // base64 previews
    const [files, setFiles] = useState([]); // raw File objects
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [lat, setLat] = useState(null);
    const [lng, setLng] = useState(null);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Enforce community selection
    useEffect(() => {
        if (authLoading) return;
        if (currentUser && !userProfile?.societyId) {
            navigate('/onboarding', { 
                state: { alertMessage: 'Please select a community to list a report' } 
            });
        }
    }, [currentUser, userProfile, authLoading, navigate]);

    // Set initial location from user's community profile
    useEffect(() => {
        if (userProfile?.lat && userProfile?.lng && !lat && !lng) {
            setLat(userProfile.lat);
            setLng(userProfile.lng);
            setLocation(`${userProfile.lat.toFixed(4)}, ${userProfile.lng.toFixed(4)}`);
        }
    }, [userProfile]);

    const showToast = (message, type = 'info') => setToast({ visible: true, message, type });

    const handleImageSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (files.length + selectedFiles.length > 4) {
            showToast('Maximum 4 photos allowed', 'warning');
            return;
        }
        
        setFiles(prev => [...prev, ...selectedFiles]);
        
        selectedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleVideoSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            showToast('Video size must be less than 25MB', 'warning');
            return;
        }
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoPreview(url);

        // Pre-upload video immediately in the background
        setIsVideoUploading(true);
        const fileName = `issues/videos/${currentUser.uid}-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp4`;
        const storageRef = ref(storage, fileName);
        
        const uploadPromise = (async () => {
            try {
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                setVideoURL(downloadURL);
                setIsVideoUploading(false);
                return downloadURL;
            } catch (err) {
                console.error("Video pre-upload failed:", err);
                setIsVideoUploading(false);
                throw err;
            }
        })();
        
        videoUploadPromiseRef.current = uploadPromise;
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            showToast('Geolocation not supported by your browser', 'error');
            return;
        }
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLat(pos.coords.latitude);
                setLng(pos.coords.longitude);
                setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                setGeoLoading(false);
                showToast('Location captured!', 'success');
            },
            () => {
                setGeoLoading(false);
                showToast('Could not get location. Please type it manually.', 'warning');
            }
        );
    };

    const readAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFlashFill = async () => {
        setAiLoading(true);
        try {
            const formattedImages = [];

            // 1. Format images
            for (const img of images) {
                const mimeType = img.split(';')[0].split(':')[1];
                const base64Data = img.split(',')[1];
                formattedImages.push({ data: base64Data, mimeType });
            }

            if (formattedImages.length === 0) {
                showToast('Please upload at least one photo first', 'warning');
                setAiLoading(false);
                return;
            }

            // Call Firebase HTTPS Callable Function
            const analyzeMediaFn = httpsCallable(functions, 'analyzeMedia');
            const response = await analyzeMediaFn({
                images: formattedImages
            });

            const data = response.data;
            
            if (data.title) setTitle(data.title.substring(0, 120));
            
            if (data.category) {
                let cat = data.category.toLowerCase().trim();
                // Map common singular/plural or synonym variations
                if (cat === 'road') cat = 'roads';
                if (cat === 'park') cat = 'parks';
                if (cat === 'light' || cat === 'streetlight' || cat === 'streetlights') cat = 'lighting';
                
                const validIds = reportCategories.map(c => c.id);
                if (validIds.includes(cat)) {
                    setCategory(cat);
                } else {
                    setCategory('other');
                }
            }
            
            if (data.description) setDescription(data.description.substring(0, 1000));

            showToast('Fields autofilled with AI! 🐝⚡', 'success');
        } catch (err) {
            console.error('AI Flash Fill failed:', err);
            showToast(err.message || 'AI analysis failed. Please try again.', 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const handleBackgroundFlashReport = () => {
        if (!currentUser) {
            showToast('Please sign in to report an issue', 'warning');
            return;
        }
        if (currentUser && !userProfile?.societyId) {
            navigate('/onboarding', { 
                state: { alertMessage: 'Please select a community to list a report' } 
            });
            return;
        }
        if (images.length === 0) {
            showToast('Please upload at least one photo first', 'warning');
            return;
        }

        // Trigger background submission in context
        submitFlashReport({
            files,
            videoFile,
            lat: lat || userProfile?.lat || 12.9716,
            lng: lng || userProfile?.lng || 77.5946,
            location: location || `${userProfile?.lat?.toFixed(4)}, ${userProfile?.lng?.toFixed(4)}`,
            landmark,
            currentUser,
            userProfile
        });

        // Navigate immediately to homepage
        navigate('/home');
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
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
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.75);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            showToast('Please sign in to report an issue', 'warning');
            return;
        }
        if (!title.trim() || !category || !description.trim() || !location.trim() || !landmark.trim()) {
            showToast('Please fill in all required fields (including landmark)', 'warning');
            return;
        }
        if (files.length === 0) {
            showToast('At least one photo is required to submit a report', 'warning');
            return;
        }

        // Trigger background submission with optimistic local UI
        submitStandardReportInBackground({
            title: title.trim(),
            description: description.trim(),
            category,
            location: location.trim(),
            landmark: landmark.trim(),
            lat: lat || 12.9716,
            lng: lng || 77.5946,
            files,
            videoURL,
            videoFile,
            videoUploadPromise: videoUploadPromiseRef.current,
            currentUser,
            userProfile
        });

        setShowSuccessModal(true);
    };

    const reportCategories = CATEGORIES.filter(c => c.id !== 'all');

    return (
        <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark overflow-y-auto">
            <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />

            {/* Header */}
            <div
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60"
                style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
                    style={{ width: '36px', height: '36px', flexShrink: 0 }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-main)' }}>arrow_back</span>
                </button>
                <div>
                    <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-outfit)' }}>Report an Issue</h1>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Help your community by reporting problems</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 flex flex-col gap-5" style={{ paddingBottom: 'calc(1.5rem + var(--safe-area-bottom))' }}>
                {/* Photo & Video upload */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Media <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(up to 4 photos, 1 video)</span>
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {/* Add photo button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors"
                            style={{
                                width: '90px',
                                height: '90px',
                                borderColor: 'var(--primary)',
                                background: 'rgba(73,145,255,0.05)',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary)' }}>add_photo_alternate</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>Add Photo</span>
                        </button>

                        {/* Add video button */}
                        {!videoPreview && (
                            <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors"
                                style={{
                                    width: '90px',
                                    height: '90px',
                                    borderColor: 'var(--primary)',
                                    background: 'rgba(73,145,255,0.05)',
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary)' }}>video_call</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>Add Video</span>
                            </button>
                        )}

                        {/* Image previews */}
                        {images.map((img, idx) => (
                            <div key={idx} className="relative flex-shrink-0" style={{ width: '90px', height: '90px' }}>
                                <img src={img} alt="" className="w-full h-full object-cover rounded-2xl" />
                                <button
                                    type="button"
                                    onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                                    style={{ width: '20px', height: '20px', background: '#ef4444' }}
                                >
                                    <span className="material-symbols-outlined text-white" style={{ fontSize: '13px' }}>close</span>
                                </button>
                            </div>
                        ))}

                        {/* Video preview */}
                        {videoPreview && (
                            <div className="relative flex-shrink-0" style={{ width: '90px', height: '90px' }}>
                                <video src={videoPreview} className="w-full h-full object-cover rounded-2xl animate-fadeIn" muted />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl pointer-events-none">
                                    {isVideoUploading ? (
                                        <div className="spinner" style={{ width: '22px', height: '22px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                    ) : (
                                        <span className="material-symbols-outlined text-white" style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>play_circle</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVideoPreview(null);
                                        setVideoFile(null);
                                        setVideoURL(null);
                                        videoUploadPromiseRef.current = null;
                                        setIsVideoUploading(false);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                                    style={{ width: '20px', height: '20px', background: '#ef4444' }}
                                >
                                    <span className="material-symbols-outlined text-white" style={{ fontSize: '13px' }}>close</span>
                                </button>
                            </div>
                        )}

                        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
                    </div>
                </div>

                {/* AI Flash Autofill Row */}
                <div 
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-surface-dark/40 backdrop-blur-md shadow-sm mt-1 pb-3 mb-2"
                >
                    {/* Gemini Star Icon */}
                    <img src="/gemini-logo.svg" alt="Gemini" style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }} />

                    {/* Action pill buttons */}
                    <div className="flex-1 flex gap-2.5">
                        {/* Flash Fill */}
                        <button
                            type="button"
                            onClick={handleFlashFill}
                            disabled={aiLoading || images.length === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 disabled:bg-slate-50 disabled:dark:bg-slate-800/20 disabled:text-slate-400 disabled:dark:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                            style={{ height: '38px' }}
                        >
                            {aiLoading ? (
                                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px', borderColor: 'rgba(73,145,255,0.3)', borderTopColor: 'var(--primary)' }} />
                            ) : (
                                <span>Flash fill</span>
                            )}
                        </button>

                        {/* Flash Report */}
                        <button
                            type="button"
                            onClick={handleBackgroundFlashReport}
                            disabled={aiLoading || images.length === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 disabled:bg-slate-50 disabled:dark:bg-slate-800/20 disabled:text-slate-400 disabled:dark:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                            style={{ height: '38px' }}
                        >
                            <span>Flash report</span>
                        </button>
                    </div>
                </div>

                {/* Title */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Issue Title <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Large pothole on MG Road"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        maxLength={120}
                        className="w-full px-4 py-3 rounded-xl border text-sm transition-all"
                        style={{
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-main)',
                            fontFamily: 'var(--font-display)',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(73,145,255,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-secondary)' }}>{title.length}/120</p>
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Category <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {reportCategories.map(cat => {
                            const isSelected = category === cat.id;
                            const styles = getCategoryStyles(cat.id, isSelected);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className="flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 transition-all active:scale-95 duration-100"
                                    style={{
                                        background: styles.background,
                                        border: styles.border,
                                        color: styles.color,
                                    }}
                                >
                                    <span 
                                        className="material-symbols-outlined" 
                                        style={{ 
                                            fontSize: '20px', 
                                            color: styles.iconColor 
                                        }}
                                    >
                                        {cat.icon}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Description <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                        placeholder="Describe the issue in detail. What happened? When did it start? How does it affect residents?"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4}
                        maxLength={1000}
                        className="w-full px-4 py-3 rounded-xl border text-sm resize-none transition-all"
                        style={{
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-main)',
                            fontFamily: 'var(--font-display)',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(73,145,255,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-secondary)' }}>{description.length}/1000</p>
                </div>

                {/* Landmark */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Landmark <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>flag</span>
                        <input
                            type="text"
                            placeholder="e.g. Near main gate, opposite park"
                            value={landmark}
                            onChange={e => setLandmark(e.target.value)}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm transition-all"
                            style={{
                                background: 'var(--surface)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-display)',
                            }}
                            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(73,145,255,0.12)'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                </div>

                {/* Location */}
                <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                        Location <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="flex gap-2">
                        <input type="hidden" value={location} />
                        <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={geoLoading}
                            className="flex items-center justify-center gap-2 rounded-xl transition-colors w-full py-3 text-sm font-bold"
                            style={{
                                background: lat ? 'rgba(16,185,129,0.12)' : 'rgba(73,145,255,0.08)',
                                border: `1.5px solid ${lat ? '#10B981' : 'var(--primary)'}`,
                                color: lat ? '#10B981' : 'var(--primary)',
                                height: '48px'
                            }}
                        >
                            {geoLoading ? (
                                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: 'rgba(73,145,255,0.3)', borderTopColor: 'var(--primary)' }} />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                        {lat ? 'my_location' : 'gps_fixed'}
                                    </span>
                                    <span>{lat ? 'Location Captured via GPS' : 'Use Current GPS Location'}</span>
                                </>
                            )}
                        </button>
                    </div>
                    {lat && (
                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#10B981' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                            GPS location captured: {lat.toFixed(4)}, {lng.toFixed(4)}
                        </p>
                    )}

                    {/* Interactive Map Selector */}
                    <div className="mt-3" style={{ height: '220px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 10, position: 'relative' }}>
                        <MapContainer
                            center={[lat || userProfile?.lat || 12.9716, lng || userProfile?.lng || 77.5946]}
                            zoom={lat ? 16 : 13}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {(lat && lng) && (
                                <Marker 
                                    position={[lat, lng]} 
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const position = marker.getLatLng();
                                            setLat(position.lat);
                                            setLng(position.lng);
                                            setLocation(`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
                                        }
                                    }}
                                />
                            )}
                            <MapEventsHandler onMapClick={(clickedLat, clickedLng) => {
                                setLat(clickedLat);
                                setLng(clickedLng);
                                setLocation(`${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`);
                            }} />
                            <RecenterMap center={(lat && lng) ? [lat, lng] : null} />
                        </MapContainer>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">Tap anywhere on the map to set location or drag the marker to adjust.</p>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading || !currentUser}
                    className="btn-primary btn-large w-full"
                    style={{ marginTop: '0.5rem' }}
                >
                    {loading ? (
                        <div className="spinner" style={{ width: '22px', height: '22px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                    ) : (
                        <>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                            Submit Report
                        </>
                    )}
                </button>

                {!currentUser && (
                    <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#f59e0b' }}>⚠️</span> Please{' '}
                        <span
                            style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => navigate('/signin')}
                        >
                            sign in
                        </span>{' '}
                        to submit a report
                    </p>
                )}
            </form>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 w-full max-w-[300px] flex flex-col items-center gap-4 shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-slideUp">
                        
                        {/* Green Badge Container */}
                        <div className="flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20" style={{ width: '56px', height: '56px' }}>
                            <span className="material-symbols-outlined text-[28px] text-[#10b981]" style={{ fontWeight: 600 }}>check_circle</span>
                        </div>

                        {/* Text Details */}
                        <div className="text-center flex flex-col gap-2.5">
                            <h3 className="font-bold text-slate-800 dark:text-white" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-outfit)', letterSpacing: '-0.02em' }}>
                                Report Listed!
                            </h3>
                            <div className="flex flex-col gap-3">
                                <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
                                    Your report will be active for <span className="text-[#4991ff] font-bold">10 days</span>.
                                </p>
                                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 leading-normal px-2">
                                    After that, You can refresh it from your profile to keep it visible.
                                    <br />
                                    Make sure to keep status up to date
                                </p>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={() => {
                                setShowSuccessModal(false);
                                navigate('/home');
                            }}
                            className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-sm transition-all active:scale-95 text-center mt-2 flex items-center justify-center"
                            style={{ height: '46px' }}
                        >
                            OK, Got it
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportIssuePage;
