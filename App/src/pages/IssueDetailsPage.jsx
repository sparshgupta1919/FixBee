import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { DetailsSkeleton } from '../components/Skeleton';
import ReportModal from '../components/ReportModal';

const STATUS_CONFIG = {
    open: { label: 'Open', icon: 'report', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    in_progress: { label: 'In Progress', icon: 'pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    resolved: { label: 'Resolved', icon: 'check_circle', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
};

const TIMELINE_STEPS = [
    { key: 'open', label: 'Reported', icon: 'flag' },
    { key: 'in_progress', label: 'In Progress', icon: 'construction' },
    { key: 'resolved', label: 'Resolved', icon: 'check_circle' },
];

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Fullscreen Image Viewer ──────────────────────────────────────────────────
const FullscreenViewer = ({ images, startIndex, onClose }) => {
    const [index, setIndex] = useState(startIndex);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [lastTap, setLastTap] = useState(0);

    // Touch tracking refs
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const lastPinchDist = useRef(null);
    const isPinching = useRef(false);
    const panStart = useRef({ x: 0, y: 0 });
    const touchStartPan = useRef({ x: 0, y: 0 });

    const resetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const goTo = (newIndex) => {
        resetZoom();
        setIndex(newIndex);
    };

    const pinchDist = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            isPinching.current = true;
            lastPinchDist.current = pinchDist(e.touches);
        } else if (e.touches.length === 1) {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchStartPan.current = pan;

            // Double tap detection
            const now = Date.now();
            if (now - lastTap < 300) {
                if (zoom > 1) {
                    resetZoom();
                } else {
                    const el = e.currentTarget.getBoundingClientRect();
                    const tapX = e.touches[0].clientX - el.left - el.width / 2;
                    const tapY = e.touches[0].clientY - el.top - el.height / 2;
                    setZoom(2.5);
                    setPan({ x: -tapX * 1.5, y: -tapY * 1.5 });
                }
            }
            setLastTap(now);
        }
    };

    const handleTouchMove = (e) => {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 2) {
            isPinching.current = true;
            if (lastPinchDist.current === null) {
                lastPinchDist.current = pinchDist(e.touches);
                return;
            }
            const dist = pinchDist(e.touches);
            const scale = dist / lastPinchDist.current;
            lastPinchDist.current = dist;
            setZoom((prev) => Math.min(Math.max(prev * scale, 1), 5));
        } else if (e.touches.length === 1 && zoom > 1) {
            const dx = e.touches[0].clientX - panStart.current.x;
            const dy = e.touches[0].clientY - panStart.current.y;
            setPan({ x: touchStartPan.current.x + dx, y: touchStartPan.current.y + dy });
        }
    };

    const handleTouchEnd = (e) => {
        if (e.touches.length < 2) {
            lastPinchDist.current = null;
        }

        if (!isPinching.current && zoom <= 1 && touchStartX.current !== null) {
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
            const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                if (dx < 0 && index < images.length - 1) goTo(index + 1);
                else if (dx > 0 && index > 0) goTo(index - 1);
            }
        }

        if (e.touches.length === 0) {
            isPinching.current = false;
            touchStartX.current = null;
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col select-none"
            style={{ touchAction: 'none' }}>
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 z-[160] flex items-center justify-between px-5 pt-12 pb-4
                bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
                <span className="text-white/60 text-sm font-semibold">
                    {index + 1} / {images.length}
                </span>
                {zoom > 1 && (
                    <button
                        className="pointer-events-auto text-white/60 text-xs font-bold bg-white/10 px-3 py-1 rounded-full active:opacity-60"
                        onClick={resetZoom}
                    >
                        Reset zoom
                    </button>
                )}
                <button
                    className="pointer-events-auto w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform"
                    onClick={onClose}
                >
                    <span className="material-symbols-outlined text-2xl">close</span>
                </button>
            </div>

            {/* Image area */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    src={images[index]}
                    alt={`Image ${index + 1}`}
                    draggable={false}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transformOrigin: 'center center',
                        transition: zoom === 1 ? 'transform 0.25s ease' : 'none',
                        userSelect: 'none',
                        WebkitUserDrag: 'none',
                    }}
                />
            </div>

            {/* Bottom dot indicators */}
            {images.length > 1 && (
                <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                    {images.map((_, i) => (
                        <div
                            key={i}
                            className={`rounded-full transition-all ${i === index
                                ? 'w-5 h-1.5 bg-white'
                                : 'w-1.5 h-1.5 bg-white/40'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Arrow buttons */}
            {index > 0 && (
                <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-[160] w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform hidden sm:flex"
                    onClick={() => goTo(index - 1)}
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
            )}
            {index < images.length - 1 && (
                <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-[160] w-10 h-10 flex items-center justify-center text-white bg-white/10 rounded-full active:scale-90 transition-transform hidden sm:flex"
                    onClick={() => goTo(index + 1)}
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            )}
        </div>
    );
};

const ImageWithSkeleton = ({ src, alt, className }) => {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
            {!loaded && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800/80 animate-pulse flex items-center justify-center">
                    <span className="material-symbols-outlined text-[48px] text-slate-400 dark:text-slate-600 animate-pulse">image</span>
                </div>
            )}
            <img
                src={src}
                alt={alt}
                className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};

const IssueDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { issues, loading, upvoteIssue } = useIssues();
    const { currentUser } = useAuth();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenIndex, setFullscreenIndex] = useState(0);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

    const issue = issues.find(i => i.id === id);
    const reporterResolvedCount = issue ? issues.filter(i => i.reporterId === issue.reporterId && i.status === 'resolved').length : 0;

    const showToast = (message, type = 'info') => setToast({ visible: true, message, type });

    if (loading) {
        return <DetailsSkeleton />;
    }

    if (!issue) {
        return (
            <div className="flex flex-col items-center justify-center h-[100dvh] gap-4">
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-secondary)' }}>error_outline</span>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Issue not found</p>
                <button className="btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={() => navigate('/home')}>Go Back</button>
            </div>
        );
    }

    const status = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
    const category = CATEGORIES.find(c => c.id === issue.category);
    const hasUpvoted = currentUser && issue.upvoterIds.includes(currentUser.uid);
    const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.key === issue.status);

    const handleUpvote = () => {
        if (!currentUser) {
            showToast('Sign in to upvote this issue', 'warning');
            return;
        }
        upvoteIssue(issue.id, currentUser.uid);
        showToast(hasUpvoted ? 'Upvote removed' : 'Issue upvoted! 👍', hasUpvoted ? 'info' : 'success');
    };

    const handleJoinConversation = () => {
        navigate(`/chat/${issue.id}`);
    };


    const handleScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const itemWidth = e.target.offsetWidth;
        if (itemWidth > 0) {
            const index = Math.round(scrollLeft / itemWidth);
            setCurrentImageIndex(index);
        }
    };

    const media = [
        ...(issue.videoURL ? [{ type: 'video', url: issue.videoURL }] : []),
        ...(issue.imageURLs || []).map(url => ({ type: 'image', url }))
    ];

    const imagesOnly = (issue.imageURLs || []);

    return (
        <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark overflow-hidden">
            <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                targetId={issue.id}
                targetType="issue"
                targetName={issue.title}
                reporterId={currentUser?.uid}
                onError={showToast}
                onSuccess={() => showToast('Report submitted successfully!', 'success')}
            />

            {/* Header */}
            <div className="shrink-0 z-30 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60 pt-safe">
                <div className="relative flex items-center px-4 py-3 justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex w-9 h-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--text-main)' }}>arrow_back_ios_new</span>
                    </button>
                    <h2 className="absolute left-1/2 -translate-x-1/2 text-sm font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 pointer-events-none" style={{ fontFamily: 'var(--font-outfit)' }}>Details</h2>
                    <div className="flex items-center gap-2">
                        {/* Report button */}
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="flex w-9 h-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-all active:scale-95 group"
                            title="Report Issue"
                        >
                            <span className="material-symbols-outlined text-[20px] text-slate-500 group-hover:text-red-500 transition-colors">flag</span>
                        </button>

                    </div>
                </div>
            </div>

            {/* Main scrollable area */}
            <main className="flex-1 overflow-y-auto">
                {/* Media Gallery Carousel */}
                <div className="relative w-full max-w-md mx-auto mt-4">
                    {media.length > 0 ? (
                        <>
                            <div
                                className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
                                onScroll={handleScroll}
                                data-no-swipe="true"
                            >
                                {media.map((item, index) => (
                                    <div key={index} className="flex w-full shrink-0 snap-center p-4 pb-2">
                                        <div
                                            className="w-full aspect-[4/5] bg-black/5 dark:bg-white/5 rounded-3xl shadow-md border border-slate-100 dark:border-slate-800 overflow-hidden flex items-center justify-center cursor-pointer"
                                            onClick={() => {
                                                if (item.type === 'image') {
                                                    const imgIndex = imagesOnly.indexOf(item.url);
                                                    setFullscreenIndex(imgIndex >= 0 ? imgIndex : 0);
                                                    setIsFullscreen(true);
                                                }
                                            }}
                                        >
                                            {item.type === 'video' ? (
                                                <video
                                                    src={item.url}
                                                    className="w-full h-full object-contain"
                                                    controls
                                                    playsInline
                                                />
                                            ) : (
                                                <ImageWithSkeleton
                                                    src={item.url}
                                                    alt={`${issue.title} - ${index}`}
                                                    className="w-full h-full object-contain"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Carousel Indicators */}
                            {media.length > 1 && (
                                <div className="flex w-full flex-row items-center justify-center gap-1.5 py-4">
                                    {media.map((_, index) => (
                                        <div
                                            key={index}
                                            className={`rounded-full transition-all ${index === currentImageIndex
                                                ? 'h-1.5 w-6 bg-primary'
                                                : 'h-1.5 w-1.5 bg-slate-300 dark:bg-slate-700'
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="px-4 py-2">
                            <div className="w-full aspect-[4/5] flex items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800" style={{ border: '1px solid var(--border)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--text-secondary)', opacity: 0.3 }}>image_not_supported</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="px-4 py-4" style={{ paddingBottom: 'calc(100px + var(--safe-area-bottom))' }}>
                    {/* Category + time */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="category-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{category?.icon || 'location_on'}</span>
                            {category?.label || issue.category}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{timeAgo(issue.createdAt)}</span>
                    </div>

                    {/* Title */}
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.75rem' }}>
                        {issue.title}
                    </h1>

                    {/* Location */}
                    <div className="flex items-center justify-between mb-4 p-2.5 rounded-xl bg-[rgba(73,145,255,0.06)] border border-[rgba(73,145,255,0.15)] gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4991ff' }}>location_on</span>
                                <span className="text-sm font-medium truncate" style={{ color: '#4991ff' }}>
                                    {issue.landmark 
                                        ? (issue.landmark.toLowerCase().startsWith('near') ? issue.landmark : `Near ${issue.landmark}`) 
                                        : issue.location
                                    }
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/map', { state: { centerLat: issue.lat, centerLng: issue.lng, focusIssueId: issue.id } })}
                            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#4991ff] hover:bg-[#357ae8] text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>map</span>
                            <span>Show on Map</span>
                        </button>
                    </div>

                    {/* Description */}
                    <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                        {issue.description}
                    </p>

                    {/* Reporter */}
                    <div className="bg-white dark:bg-slate-900/40 rounded-[24px] p-4 border border-slate-100 dark:border-slate-800/50 shadow-sm flex items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="relative shrink-0">
                                <img
                                    src={issue.reporterPhoto && issue.reporterPhoto !== 'null' && issue.reporterPhoto !== 'undefined' ? issue.reporterPhoto : `https://ui-avatars.com/api/?name=${issue.reporterName}&background=4991ff&color=fff`}
                                    alt={issue.reporterName}
                                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${issue.reporterName}&background=4991ff&color=fff`; }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    {issue.reporterName}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Reported this issue
                                </p>
                            </div>
                        </div>

                        {/* Resolved Stats */}
                        <div className="shrink-0 text-center bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Resolved</p>
                            <p className="text-base font-black text-primary">
                                {reporterResolvedCount}
                            </p>
                        </div>
                    </div>

                    {/* Status Timeline */}
                    <div className="mb-5">
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Issue Progress</h3>
                        <div className="flex items-center">
                            {TIMELINE_STEPS.map((step, idx) => {
                                const isDone = idx <= currentStepIndex;
                                const isActive = idx === currentStepIndex;
                                return (
                                    <div key={step.key} className="flex items-center" style={{ flex: idx < TIMELINE_STEPS.length - 1 ? 1 : 'none' }}>
                                        <div className="flex flex-col items-center">
                                            <div
                                                className="rounded-full flex items-center justify-center mb-1"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    background: isDone ? '#4991ff' : 'var(--border)',
                                                    boxShadow: isActive ? '0 0 0 3px rgba(73,145,255,0.25)' : 'none',
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isDone ? 'white' : 'var(--text-secondary)' }}>
                                                    {step.icon}
                                                </span>
                                            </div>
                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: isDone ? '#4991ff' : 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < TIMELINE_STEPS.length - 1 && (
                                            <div
                                                className="flex-1 mx-1"
                                                style={{ height: '2px', background: idx < currentStepIndex ? '#4991ff' : 'var(--border)', marginBottom: '18px', borderRadius: '2px' }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* Fixed bottom action buttons */}
            <div
                className="fixed bottom-0 left-0 right-0 px-4 py-3 flex gap-3 z-40"
                style={{
                    background: 'var(--surface)',
                    borderTop: '1px solid var(--border)',
                    paddingBottom: 'calc(0.75rem + var(--safe-area-bottom))',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {/* Upvote */}
                <button
                    onClick={handleUpvote}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-95"
                    style={{
                        padding: '0.875rem',
                        background: hasUpvoted ? '#4991ff' : 'rgba(73,145,255,0.08)',
                        color: hasUpvoted ? 'white' : '#4991ff',
                        border: `1.5px solid ${hasUpvoted ? '#4991ff' : 'rgba(73,145,255,0.3)'}`,
                        fontSize: '0.95rem',
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: hasUpvoted ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
                    {hasUpvoted ? 'Upvoted' : 'Upvote'} ({issue.upvotes})
                </button>

                {/* Join Conversation */}
                <button
                    onClick={handleJoinConversation}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold btn-primary transition-all active:scale-95"
                    style={{ padding: '0.875rem', fontSize: '0.95rem' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat_bubble</span>
                    Join Conversation
                </button>
            </div>

            {isFullscreen && (
                <FullscreenViewer
                    images={imagesOnly}
                    startIndex={fullscreenIndex}
                    onClose={() => setIsFullscreen(false)}
                />
            )}
        </div>
    );
};

export default IssueDetailsPage;
