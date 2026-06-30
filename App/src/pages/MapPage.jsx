import { useMemo, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const STATUS_CONFIG = {
    open: { label: 'Open', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
};

// Haversine formula to compute distance in km
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Create custom divIcon pins with status colors
const createCustomMarker = (status) => {
    let color = '#ef4444'; // Red for Open
    if (status === 'in_progress') color = '#f59e0b'; // Orange for In Progress
    if (status === 'resolved') color = '#10B981'; // Green for Resolved

    return L.divIcon({
        className: 'custom-map-pin',
        html: `
            <div style="
                background-color: ${color};
                width: 28px;
                height: 28px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            ">
                <div style="
                    background-color: white;
                    width: 9px;
                    height: 9px;
                    border-radius: 50%;
                    transform: rotate(45deg);
                "></div>
            </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -24]
    });
};

// Component to programmatically recenter and zoom leaflet map
const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat !== undefined && lng !== undefined) {
            map.setView([lat, lng], 16);
        }
    }, [lat, lng, map]);
    return null;
};

const MapPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { issues } = useIssues();
    const { userProfile } = useAuth();
    
    const { centerLat, centerLng, focusIssueId } = location.state || {};
    const markerRefs = useRef({});

    const [selectedStatuses, setSelectedStatuses] = useState(['open', 'in_progress', 'resolved']);

    // 2-second mandatory loader state
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [loadingStage, setLoadingStage] = useState('Initializing map services...');

    useEffect(() => {
        const duration = 2000; // 2 seconds
        const intervalTime = 30; // update every 30ms
        const increment = (100 / duration) * intervalTime;

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + increment;
                if (next >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return next;
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (progress < 25) {
            setLoadingStage('Initializing map services...');
        } else if (progress < 55) {
            setLoadingStage('Locating community center...');
        } else if (progress < 85) {
            setLoadingStage('Scanning nearby issues...');
        } else {
            setLoadingStage('Ready!');
        }

        if (progress >= 100) {
            const timeout = setTimeout(() => {
                setIsLoading(false);
            }, 150); // tiny extra delay for smoothness
            return () => clearTimeout(timeout);
        }
    }, [progress]);

    const toggleStatus = (statusKey) => {
        setSelectedStatuses(prev => {
            if (prev.includes(statusKey)) {
                return prev.filter(s => s !== statusKey);
            } else {
                return [...prev, statusKey];
            }
        });
    };

    const userLat = userProfile?.lat || 12.9716;
    const userLng = userProfile?.lng || 77.5946;

    // Filter issues to "nearby" (matching same community only) matching the selected statuses
    const nearbyIssues = useMemo(() => {
        if (!userProfile?.societyId) return [];

        return issues.filter(issue => {
            // Strictly same community only
            if (issue.societyId !== userProfile.societyId) return false;

            // Apply status filter (unless it's the forced focusIssueId)
            const matchesStatus = selectedStatuses.includes(issue.status);
            if (!matchesStatus && issue.id !== focusIssueId) return false;

            // Exclude inactive reports (older than 10 days) (unless it's the forced focusIssueId)
            const isRecent = Date.now() - new Date(issue.createdAt).getTime() < 10 * 24 * 60 * 60 * 1000;
            if (!isRecent && issue.id !== focusIssueId) return false;

            return true;
        });
    }, [issues, userProfile?.societyId, focusIssueId, selectedStatuses]);

    const hasOpenedPopup = useRef(false);

    useEffect(() => {
        hasOpenedPopup.current = false;
    }, [focusIssueId]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark justify-between overflow-hidden relative font-outfit">
                {/* Embedded styles for beautiful animations */}
                <style>{`
                    @keyframes radar-pulse {
                        0% {
                            transform: scale(0.6);
                            opacity: 0.8;
                        }
                        100% {
                            transform: scale(2.2);
                            opacity: 0;
                        }
                    }
                    @keyframes radar-scan {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .animate-radar-pulse-1 {
                        animation: radar-pulse 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
                    }
                    .animate-radar-pulse-2 {
                        animation: radar-pulse 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
                        animation-delay: 0.7s;
                    }
                    .animate-radar-pulse-3 {
                        animation: radar-pulse 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
                        animation-delay: 1.4s;
                    }
                    .animate-radar-scan {
                        animation: radar-scan 4s linear infinite;
                    }
                    .grid-bg {
                        background-size: 32px 32px;
                        background-image: 
                            linear-gradient(to right, rgba(73, 145, 255, 0.04) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(73, 145, 255, 0.04) 1px, transparent 1px);
                    }
                    .dark .grid-bg {
                        background-image: 
                            linear-gradient(to right, rgba(73, 145, 255, 0.06) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(73, 145, 255, 0.06) 1px, transparent 1px);
                    }
                `}</style>

                {/* Radar Grid Background */}
                <div className="absolute inset-0 grid-bg opacity-80 z-0 pointer-events-none" />

                {/* Header (Matching MapPage top bar header structure for smooth layout change) */}
                <div className="z-10 bg-white/40 dark:bg-surface-dark/40 backdrop-blur-md border-b border-slate-100/50 dark:border-slate-800/40" style={{ paddingTop: 'var(--safe-area-top)' }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-slate-800/50 animate-pulse" />
                        <div>
                            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700/60 rounded-full animate-pulse mb-1.5" />
                            <div className="h-3 w-56 bg-slate-150 dark:bg-slate-800/60 rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Main Scan Section */}
                <div className="flex-1 flex flex-col items-center justify-center z-10 px-6 relative">
                    {/* Concentric radar circle with pulsing scanner */}
                    <div className="relative w-64 h-64 flex items-center justify-center rounded-full border border-primary/10 dark:border-primary/5 bg-primary/[0.01]">
                        {/* Inner circles */}
                        <div className="absolute w-48 h-48 rounded-full border border-primary/10 dark:border-primary/5" />
                        <div className="absolute w-32 h-32 rounded-full border border-primary/20 dark:border-primary/10" />
                        <div className="absolute w-16 h-16 rounded-full border border-primary/30 dark:border-primary/20" />

                        {/* Radar Pulses */}
                        <div className="absolute w-32 h-32 rounded-full bg-primary/15 animate-radar-pulse-1 pointer-events-none" />
                        <div className="absolute w-32 h-32 rounded-full bg-primary/15 animate-radar-pulse-2 pointer-events-none" />
                        <div className="absolute w-32 h-32 rounded-full bg-primary/15 animate-radar-pulse-3 pointer-events-none" />

                        {/* Sweeping line */}
                        <div className="absolute inset-0 rounded-full overflow-hidden animate-radar-scan pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 w-[50%] h-[2px] bg-gradient-to-r from-primary to-transparent origin-left" style={{ transform: 'translateY(-50%)' }} />
                        </div>

                        {/* Central Glowing Pin */}
                        <div className="relative z-20 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-xl shadow-primary/30 border-2 border-white dark:border-slate-900 transition-all">
                            <span className="material-symbols-outlined text-[26px] animate-bounce">location_on</span>
                        </div>

                        {/* Simulated issue markers appearing/pulsating */}
                        <div className="absolute top-8 left-12 w-3 h-3 rounded-full bg-[#ef4444] animate-pulse" />
                        <div className="absolute bottom-12 right-10 w-3.5 h-3.5 rounded-full bg-[#f59e0b] animate-pulse" style={{ animationDelay: '0.5s' }} />
                        <div className="absolute top-20 right-16 w-3 h-3 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '0.8s' }} />
                    </div>

                    {/* Progress details */}
                    <div className="mt-12 text-center w-full max-w-[280px]">
                        <h2 className="text-lg font-bold text-text-main tracking-wide">
                            {loadingStage}
                        </h2>
                        <p className="text-xs text-text-secondary dark:text-slate-400 mt-1.5 font-medium tracking-wide">
                            {Math.round(progress)}% loaded
                        </p>

                        {/* Modern Linear Progress Bar */}
                        <div className="mt-5 w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary rounded-full transition-all duration-75 ease-out shadow-sm"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Navigation Mock to maintain page layout symmetry */}
                <div className="z-10 border-t border-slate-100/50 dark:border-slate-800/40 bg-white/40 dark:bg-surface-dark/40 backdrop-blur-md pb-6 pt-3 px-6 flex justify-around items-center">
                    <div className="h-8 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg animate-pulse" />
                    <div className="h-8 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg animate-pulse" />
                    <div className="h-8 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg animate-pulse" />
                    <div className="h-8 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark has-bottom-nav overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60" style={{ paddingTop: 'var(--safe-area-top)' }}>
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-shrink-0 flex w-9 h-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-all active:scale-95"
                        title="Go Back"
                    >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--text-main)' }}>arrow_back</span>
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-outfit)', lineHeight: 1 }}>
                            Community Issues Map
                        </h1>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '2px' }}>
                            Showing issues from your community only
                        </p>
                    </div>
                </div>

                {/* Status multi-select filter chips */}
                <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
                    {[
                        { key: 'open', label: 'Open', color: '#ef4444', icon: 'report' },
                        { key: 'in_progress', label: 'In Progress', color: '#f59e0b', icon: 'pending' },
                        { key: 'resolved', label: 'Resolved', color: '#10B981', icon: 'check_circle' },
                    ].map(status => {
                        const isSelected = selectedStatuses.includes(status.key);
                        return (
                            <button
                                key={status.key}
                                onClick={() => toggleStatus(status.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0 text-xs font-bold ${
                                    isSelected
                                        ? 'text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                                style={{
                                    backgroundColor: isSelected ? status.color : undefined,
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{status.icon}</span>
                                {status.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 w-full relative">
                <MapContainer
                    center={[centerLat || userLat, centerLng || userLng]}
                    zoom={focusIssueId ? 16 : 14}
                    style={{ height: '100%', width: '100%' }}
                >
                    <RecenterMap lat={centerLat} lng={centerLng} />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* User location pin */}
                    <Marker 
                        position={[userLat, userLng]}
                        icon={L.divIcon({
                            className: 'user-pin',
                            html: `
                                <div style="display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: #4991ff; border: 3px solid white; box-shadow: 0 0 10px rgba(73,145,255,0.6)">
                                    <div style="width: 6px; height: 6px; border-radius: 50%; background: white;"></div>
                                </div>
                            `,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })}
                    >
                        <Popup>Your Community Center</Popup>
                    </Marker>

                    {/* Nearby reports */}
                    {nearbyIssues.map(issue => (
                        <Marker 
                            key={issue.id} 
                            position={[issue.lat, issue.lng]}
                            icon={createCustomMarker(issue.status)}
                            ref={el => {
                                if (el) {
                                    markerRefs.current[issue.id] = el;
                                    if (issue.id === focusIssueId && !hasOpenedPopup.current) {
                                        hasOpenedPopup.current = true;
                                        setTimeout(() => {
                                            el.openPopup();
                                        }, 150);
                                    }
                                } else {
                                    delete markerRefs.current[issue.id];
                                }
                            }}
                        >
                            <Popup>
                                <div style={{ minWidth: '200px' }}>
                                    <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px', color: 'var(--text-main)' }}>{issue.title}</p>
                                    <p style={{ fontSize: '0.75rem', color: '#666' }}>{issue.location}</p>
                                    
                                    {/* Thumbnail Preview */}
                                    {issue.imageURLs?.[0] && (
                                        <img 
                                            src={issue.imageURLs[0]} 
                                            alt="" 
                                            style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} 
                                        />
                                    )}

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '999px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: STATUS_CONFIG[issue.status]?.bg,
                                            color: STATUS_CONFIG[issue.status]?.color
                                        }}>{STATUS_CONFIG[issue.status]?.label}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#666' }}>👍 {issue.upvotes}</span>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/issue/${issue.id}`)}
                                        style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#4991ff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};

export default MapPage;
