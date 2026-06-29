import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { HomeSkeleton } from '../components/Skeleton';

const STATUS_CONFIG = {
    open: { label: 'Open', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const ImageWithSkeleton = ({ src, alt, className }) => {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className="relative w-full h-full overflow-hidden">
            {!loaded && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800/80 animate-pulse flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px] text-slate-400 dark:text-slate-600 animate-pulse">image</span>
                </div>
            )}
            <img
                src={src}
                alt={alt}
                className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                onLoad={() => setLoaded(true)}
                loading="lazy"
            />
        </div>
    );
};

const IssueCard = ({ issue, onClick }) => {
    const status = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
    const category = CATEGORIES.find(c => c.id === issue.category);

    return (
        <div 
            className={`issue-card animate-slideUp ${issue.isUploading ? 'opacity-80 pointer-events-none' : 'cursor-pointer'}`} 
            onClick={issue.isUploading ? undefined : onClick}
        >
            {/* Image */}
            {issue.imageURLs?.[0] && (
                <div className="relative overflow-hidden" style={{ height: '180px' }}>
                    <ImageWithSkeleton
                        src={issue.imageURLs[0]}
                        alt={issue.title}
                        className="w-full h-full object-cover"
                    />
                    {/* Video badge overlay */}
                    {issue.videoURL && (
                        <div
                            className="absolute top-2 left-2 flex items-center justify-center rounded-full bg-black/50 text-white shadow-sm"
                            style={{ width: '26px', height: '26px', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>play_arrow</span>
                        </div>
                    )}
                    {/* Status chip over image */}
                    {issue.isUploading ? (
                        <div
                            className="absolute top-2 right-2 status-chip flex items-center gap-1.5"
                            style={{ background: 'rgba(73,145,255,0.15)', color: '#4991ff', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(73,145,255,0.2)' }}
                        >
                            <div className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1px', borderColor: 'rgba(73,145,255,0.3)', borderTopColor: '#4991ff' }} />
                            <span style={{ fontSize: '10px', fontWeight: 800 }}>Uploading...</span>
                        </div>
                    ) : (
                        <div
                            className="absolute top-2 right-2 status-chip"
                            style={{ background: status.bg, color: status.color, backdropFilter: 'blur(8px)' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                                {issue.status === 'open' ? 'report' : issue.status === 'in_progress' ? 'pending' : 'check_circle'}
                            </span>
                            {status.label}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="p-3">
                {/* Category + time */}
                <div className="flex items-center justify-between mb-1.5">
                    <div className="category-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                            {category?.icon || 'location_on'}
                        </span>
                        {category?.label || issue.category}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {timeAgo(issue.createdAt)}
                    </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold line-clamp-2 mb-1.5" style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {issue.title}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1 mb-2.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>location_on</span>
                    <span className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{issue.location}</span>
                </div>

                {/* Footer: reporter + stats */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {issue.reporterPhoto && issue.reporterPhoto !== 'null' && issue.reporterPhoto !== 'undefined' ? (
                            <img
                                src={issue.reporterPhoto}
                                alt={issue.reporterName}
                                className="rounded-full"
                                style={{ width: '20px', height: '20px', objectFit: 'cover' }}
                            />
                        ) : (
                            <div 
                                className="rounded-full flex items-center justify-center bg-primary text-[8px] font-bold text-white font-outfit"
                                style={{ width: '20px', height: '20px' }}
                            >
                                {issue.reporterName?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                        <span className="text-xs font-medium line-clamp-1" style={{ color: 'var(--text-secondary)', maxWidth: '100px' }}>
                            {issue.reporterName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#4991ff' }}>thumb_up</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>{issue.upvotes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>chat_bubble</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>{issue.commentCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
};

const HomePage = () => {
    const navigate = useNavigate();
    const { issues, loading, CATEGORIES: cats } = useIssues();
    const { currentUser, userProfile } = useAuth();
    const { unreadCount } = useNotifications();

    const handleReportClick = () => {
        if (!userProfile?.societyId) {
            navigate('/onboarding', { 
                state: { alertMessage: 'Please select a community to list a report' } 
            });
        } else {
            navigate('/report');
        }
    };
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeStatus, setActiveStatus] = useState('all'); // Track active status filter ('all', 'open', 'in_progress', 'resolved')
    const [searchQuery, setSearchQuery] = useState('');
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [societyName, setSocietyName] = useState('');
    const [memberCount, setMemberCount] = useState(0);

    useEffect(() => {
        if (!userProfile?.societyId) {
            setSocietyName('');
            setMemberCount(0);
            return;
        }

        const fetchSocietyData = async () => {
            try {
                // Fetch society name
                const docRef = doc(db, 'societies', userProfile.societyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSocietyName(docSnap.data().name);
                }

                // Fetch total members in this society
                const usersQuery = query(
                    collection(db, 'users'),
                    where('societyId', '==', userProfile.societyId)
                );
                const usersSnap = await getDocs(usersQuery);
                setMemberCount(usersSnap.size);
            } catch (err) {
                console.error('Error fetching society data:', err);
            }
        };

        fetchSocietyData();
    }, [userProfile?.societyId]);

    const toggleTheme = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        document.documentElement.classList.toggle('dark', newDark);
        localStorage.setItem('fixbee_theme', newDark ? 'dark' : 'light');
    };

    useEffect(() => {
        const saved = localStorage.getItem('fixbee_theme');
        if (saved) {
            const dark = saved === 'dark';
            setIsDark(dark);
            document.documentElement.classList.toggle('dark', dark);
        }
    }, []);

    // Prefetch/preload other main page bundles in the background after the home page loads
    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                const pagesToPreload = [
                    () => import('./MapPage'),
                    () => import('./ChatListPage'),
                    () => import('./ProfilePage'),
                    () => import('./NotificationsPage'),
                    () => import('./ReportIssuePage'),
                    () => import('./IssueDetailsPage'),
                    () => import('./ChatPage')
                ];
                pagesToPreload.forEach(preload => {
                    try {
                        preload();
                    } catch (e) {
                        console.warn("Failed to prefetch page module:", e);
                    }
                });
            }, 1500); // 1.5s delay to let home page load settle first

            return () => clearTimeout(timer);
        }
    }, [loading]);

    // Issues matching category, search, and community bounds (without status filter applied)
    const filteredCommunityIssues = useMemo(() => {
        return issues.filter(issue => {
            const matchesCategory = activeCategory === 'all' || issue.category === activeCategory;
            const matchesSearch = !searchQuery ||
                issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                issue.location.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (!matchesCategory || !matchesSearch) return false;

            // Exclude inactive reports (older than 10 days)
            const isRecent = Date.now() - new Date(issue.createdAt).getTime() < 10 * 24 * 60 * 60 * 1000;
            if (!isRecent) return false;

            // Same community only
            return !!(userProfile?.societyId && issue.societyId === userProfile.societyId);
        });
    }, [issues, userProfile, activeCategory, searchQuery]);

    // Issues with status filter applied
    const filteredIssues = useMemo(() => {
        if (activeStatus === 'all') return filteredCommunityIssues;
        return filteredCommunityIssues.filter(issue => issue.status === activeStatus);
    }, [filteredCommunityIssues, activeStatus]);

    return (
        <div 
            className="flex flex-col h-[100dvh] has-bottom-nav overflow-hidden"
            style={{ background: 'var(--chat-list-bg)' }}
        >

            {/* Header */}
            <div 
                className="sticky top-0 z-20 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60" 
                style={{ paddingTop: 'var(--safe-area-top)', background: 'var(--header-bg)' }}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: 'white', border: '1px solid rgba(73,145,255,0.2)', flexShrink: 0 }}>
                            <img src="/fixbee-logo.svg" alt="FixBee" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-outfit)', lineHeight: 1 }}>
                                FixBee
                            </h1>
                            <p className="flex items-center gap-1.5" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1, marginTop: '2px' }}>
                                <span className="flex items-center gap-0.5">
                                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                                    <span>{societyName || 'Community Issues'}</span>
                                </span>
                                {memberCount > 0 && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(73, 145, 255, 0.08)', color: '#4991ff', fontSize: '0.62rem', fontWeight: 600 }}>
                                        <span className="material-symbols-outlined shrink-0" style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>groups</span>
                                        <span>{memberCount}</span>
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => navigate('/notifications')}
                                className="flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
                                style={{ width: '32px', height: '32px' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '17px', color: 'var(--text-secondary)' }}>
                                    notifications
                                </span>
                            </button>
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-surface-dark rounded-full"></span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>search</span>
                        <input
                            type="text"
                            placeholder="Search issues by title or location..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full py-2.5 pl-9 pr-4 rounded-full text-sm bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-slate-700 transition-all"
                            style={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}
                        />
                    </div>
                </div>

                {/* Category filter chips */}
                <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0 text-xs font-semibold ${
                                activeCategory === cat.id
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>

            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <>
                        {/* Stats bar skeleton with header background */}
                        <div 
                            className="border-b border-slate-100 dark:border-slate-800/60 pb-3 pt-3" 
                            style={{ background: 'var(--header-bg)' }}
                        >
                            <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-[75px] h-[68px] rounded-xl bg-slate-200/50 dark:bg-slate-800/80 animate-pulse flex flex-col items-center justify-center gap-1.5 p-2" />
                                ))}
                            </div>
                        </div>
                        <HomeSkeleton />
                    </>
                ) : (
                    /* Feed View */
                    <div className="flex flex-col">
                        {/* Stats bar with header background */}
                        <div 
                            className="border-b border-slate-100 dark:border-slate-800/60 pb-3 pt-3" 
                            style={{ background: 'var(--header-bg)' }}
                        >
                            <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-1">
                                {[
                                    { label: 'Total', key: 'all', value: filteredCommunityIssues.length, icon: 'list_alt', color: '#4991ff' },
                                    { label: 'Open', key: 'open', value: filteredCommunityIssues.filter(i => i.status === 'open').length, icon: 'report', color: '#ef4444' },
                                    { label: 'In Progress', key: 'in_progress', value: filteredCommunityIssues.filter(i => i.status === 'in_progress').length, icon: 'pending', color: '#f59e0b' },
                                    { label: 'Resolved', key: 'resolved', value: filteredCommunityIssues.filter(i => i.status === 'resolved').length, icon: 'check_circle', color: '#10B981' },
                                ].map(stat => {
                                    const isActive = activeStatus === stat.key;
                                    return (
                                        <div
                                            key={stat.label}
                                            onClick={() => setActiveStatus(stat.key)}
                                            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl p-2.5 min-w-[75px] cursor-pointer transition-all active:scale-95 duration-150"
                                            style={{
                                                background: isActive ? stat.color : `${stat.color}12`,
                                                border: `1px solid ${isActive ? stat.color : `${stat.color}25`}`,
                                                boxShadow: isActive ? `0 4px 12px ${stat.color}40` : 'none',
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: isActive ? '#fff' : stat.color }}>{stat.icon}</span>
                                            <span className="font-bold" style={{ fontSize: '1.1rem', color: isActive ? '#fff' : stat.color, lineHeight: 1.2 }}>{stat.value}</span>
                                            <span style={{ fontSize: '0.65rem', color: isActive ? '#fff' : stat.color, opacity: isActive ? 0.9 : 0.8, fontWeight: 600 }}>{stat.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Feed View content (cards) */}
                        <div className="px-4 py-4">
                            {/* Issue cards */}
                            {filteredCommunityIssues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 px-6 font-display text-center animate-fadeIn">
                                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center border border-slate-200/20 shadow-inner">
                                        <span className="material-symbols-outlined text-[36px] text-slate-400 dark:text-slate-500">inventory_2</span>
                                    </div>
                                    <h3 className="font-extrabold text-base text-text-main mt-5">No reports found</h3>
                                    <p className="text-xs text-text-secondary dark:text-slate-400 max-w-[240px] mt-2 leading-relaxed">
                                        No reports have been posted in your community yet.
                                    </p>
                                    <button
                                        onClick={handleReportClick}
                                        className="btn-primary mt-6 px-8 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-primary/20 hover:-translate-y-[1px] active:translate-y-[1px] transition-all"
                                    >
                                        Report an Issue
                                    </button>
                                </div>
                            ) : filteredIssues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fadeIn">
                                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '48px' }}>search_off</span>
                                    <p className="font-semibold text-text-main">No issues found</p>
                                    <p className="text-xs text-center text-text-secondary dark:text-slate-400 max-w-[220px] leading-relaxed">Try a different category or search term</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filteredIssues.map(issue => (
                                        <IssueCard
                                            key={issue.id}
                                            issue={issue}
                                            onClick={() => navigate(`/issue/${issue.id}`)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            {/* FAB for Reporting */}
            <button
                onClick={handleReportClick}
                className="fixed z-50 flex items-center justify-center gap-2 px-5 h-14 rounded-xl bg-primary border-2 border-white transition-all duration-200 active:scale-95 shadow-lg"
                style={{ 
                    bottom: 'calc(var(--safe-area-bottom) + 5.5rem)', 
                    right: '1.25rem',
                    boxShadow: '0 4px 20px rgba(73, 145, 255, 0.4)' 
                }}
            >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0" }}>add_circle</span>
                <span className="text-white font-bold text-[15px]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>REPORT</span>
            </button>
        </div>
        </div>
    );
};

export default HomePage;
