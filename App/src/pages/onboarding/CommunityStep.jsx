import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, doc, setDoc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../../components/Toast';
import honeycombBg from '../../assets/signin/honeycomb.svg';
import path1Bg from '../../assets/signin/path-1.svg';
import path2Bg from '../../assets/signin/path-2.svg';
import path3Bg from '../../assets/signin/path-3.svg';
import path4Bg from '../../assets/signin/path-4.svg';
import beeSvg from '../../assets/signin/bee.svg';
import './CampusSelectionPage.css';

const CommunityStep = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [societies, setSocieties] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

    const showToast = (message, type = 'info') => setToast({ visible: true, message, type });

    // Show warning alert if redirected
    useEffect(() => {
        if (location.state?.alertMessage) {
            showToast(location.state.alertMessage, 'warning');
        }
    }, [location.state]);

    // Fetch existing societies
    useEffect(() => {
        const fetchSocieties = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'societies'));
                const list = [];
                querySnapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
                setSocieties(list);

                // Backfill missing pincodes for loaded societies asynchronously
                list.forEach(async (soc) => {
                    if (!soc.pincode && soc.lat && soc.lng) {
                        try {
                            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${soc.lat}&lon=${soc.lng}&zoom=18&addressdetails=1`, {
                                headers: { 'Accept-Language': 'en' }
                            });
                            const data = await response.json();
                            const rawPostcode = data?.address?.postcode;
                            if (rawPostcode) {
                                const cleaned = rawPostcode.replace(/\D/g, '');
                                if (cleaned.length >= 6) {
                                    const pincode = cleaned.substring(0, 6);
                                    await updateDoc(doc(db, 'societies', soc.id), { pincode });
                                    setSocieties(prev => prev.map(s => s.id === soc.id ? { ...s, pincode } : s));
                                    console.log(`Backfilled pincode ${pincode} for society ${soc.name}`);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to backfill pincode for society ${soc.id}:`, err);
                        }
                    }
                });
            } catch (err) {
                console.error('Error fetching societies', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSocieties();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    const filteredSocieties = useMemo(() => {
        const gpsSocieties = [];
        const pincodeOnlySocieties = [];

        societies.forEach(s => {
            let added = false;
            if (userProfile?.lat && userProfile?.lng && s.lat && s.lng) {
                const dist = getDistanceInKm(userProfile.lat, userProfile.lng, s.lat, s.lng);
                if (dist !== null && dist <= 5) {
                    gpsSocieties.push({ ...s, distance: dist });
                    added = true;
                }
            }
            if (!added && userProfile?.pincode && s.pincode === userProfile.pincode) {
                pincodeOnlySocieties.push(s);
            }
        });

        // Sort GPS societies by distance (closest first)
        gpsSocieties.sort((a, b) => a.distance - b.distance);

        const sortedNearby = [...gpsSocieties, ...pincodeOnlySocieties];

        if (!debouncedQuery || debouncedQuery.length < 1) return sortedNearby;
        const q = debouncedQuery.toLowerCase();
        return sortedNearby.filter(s => s.name.toLowerCase().includes(q));
    }, [debouncedQuery, societies, userProfile]);

    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newCommunityName, setNewCommunityName] = useState('');

    const handleAddNew = async (name) => {
        if (!name.trim()) return;
        setActionLoading(true);
        try {
            const newId = `soc_${Date.now()}`;
            
            let resolvedPincode = userProfile?.pincode || null;
            if (!resolvedPincode && userProfile?.lat && userProfile?.lng) {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userProfile.lat}&lon=${userProfile.lng}&zoom=18&addressdetails=1`, {
                        headers: { 'Accept-Language': 'en' }
                    });
                    const data = await response.json();
                    const rawPostcode = data?.address?.postcode;
                    if (rawPostcode) {
                        const cleaned = rawPostcode.replace(/\D/g, '');
                        if (cleaned.length >= 6) {
                            resolvedPincode = cleaned.substring(0, 6);
                        }
                    }
                } catch (err) {
                    console.error('Failed to reverse geocode society pincode during creation:', err);
                }
            }

            const newSociety = {
                name: name.trim(),
                pincode: resolvedPincode,
                lat: userProfile?.lat || null,
                lng: userProfile?.lng || null,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'societies', newId), newSociety);
            setSocieties(prev => [...prev, { id: newId, ...newSociety }]);
            setNewCommunityName('');
            setIsAddingNew(false);
            setSelectedId(newId);
            showToast('Community added!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to add community', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleContinue = async () => {
        setActionLoading(true);
        try {
            if (selectedId) {
                // 1. Join society
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, { societyId: selectedId });

                // 2. Query all users belonging to this society to calculate the new mean location, filtering out outliers (> 10 km)
                try {
                    const societyRef = doc(db, 'societies', selectedId);
                    const societySnap = await getDoc(societyRef);
                    const societyData = societySnap.exists() ? societySnap.data() : null;
                    const baseLat = societyData?.lat;
                    const baseLng = societyData?.lng;

                    const usersQuery = query(collection(db, 'users'), where('societyId', '==', selectedId));
                    const usersSnapshot = await getDocs(usersQuery);
                    
                    let totalLat = 0;
                    let totalLng = 0;
                    let validCoordsCount = 0;

                    const checkAndAddUserCoords = (uLat, uLng) => {
                        const userLat = Number(uLat);
                        const userLng = Number(uLng);

                        // If society has established coordinates, filter out coordinates further than 10 km
                        if (baseLat !== undefined && baseLat !== null && baseLng !== undefined && baseLng !== null) {
                            const dist = getDistanceInKm(baseLat, baseLng, userLat, userLng);
                            if (dist === null || dist > 10) {
                                return; // Skip coordinate outliers
                            }
                        }

                        totalLat += userLat;
                        totalLng += userLng;
                        validCoordsCount++;
                    };

                    usersSnapshot.forEach((userDoc) => {
                        const userData = userDoc.data();
                        if (userData.lat !== undefined && userData.lng !== undefined && userData.lat !== null && userData.lng !== null) {
                            checkAndAddUserCoords(userData.lat, userData.lng);
                        }
                    });

                    // Ensure latest user's coordinates are included even if not returned by Firestore query yet
                    const isCurrentUserIncluded = usersSnapshot.docs.some(d => d.id === currentUser.uid);
                    if (!isCurrentUserIncluded) {
                        const freshUserSnap = await getDoc(userRef);
                        const freshUserData = freshUserSnap.data();
                        if (freshUserData?.lat && freshUserData?.lng) {
                            checkAndAddUserCoords(freshUserData.lat, freshUserData.lng);
                        }
                    }

                    if (validCoordsCount > 0) {
                        const meanLat = totalLat / validCoordsCount;
                        const meanLng = totalLng / validCoordsCount;

                        await updateDoc(societyRef, {
                            lat: meanLat,
                            lng: meanLng,
                            memberCount: validCoordsCount
                        });
                    }
                } catch (calcErr) {
                    console.error('Error updating society location centroid:', calcErr);
                }
            } else {
                // Skip — mark onboarding done without a society
                await updateDoc(doc(db, 'users', currentUser.uid), { locationGranted: true });
            }
            navigate('/home', { replace: true });
        } catch (err) {
            console.error(err);
            showToast('Failed to save. Please try again.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="campus-selection-page">
            <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />

            <div className="campus-container">
                <div className="campus-content">

                    {/* Honeycomb + bees — exact CampXchange structure */}
                    <div className="campus-logo">
                        <div className="honeycomb-hero">
                            <img src={honeycombBg} alt="FixBee" aria-hidden="true" className="honeycomb-icon" />
                            <div className="bee-orbit bee-1"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-2"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-3"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-4"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                        </div>
                        <h1 className="campus-title">Select your<br />community</h1>
                        <p className={`campus-subtitle ${isSearchFocused ? 'hidden' : ''}`}>
                            We found these communities near you
                        </p>
                    </div>

                    {/* Unified Society Box Container */}
                    <div className="campus-list-container" style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--surface)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        boxShadow: 'var(--shadow-sm)',
                        marginBottom: '1.5rem'
                    }}>
                        {/* List Area */}
                        <div style={{ 
                            maxHeight: '260px', 
                            overflowY: 'auto',
                            padding: '0.5rem'
                        }}>
                            {loading ? (
                                <div className="loading-state" style={{ padding: '2rem 1rem' }}>
                                    <span className="material-symbols-outlined loading-icon">progress_activity</span>
                                    <p>Loading communities...</p>
                                </div>
                            ) : filteredSocieties.length > 0 ? (
                                filteredSocieties.map(soc => (
                                    <label key={soc.id} className="campus-option" style={{ margin: '0.25rem 0', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="radio"
                                            name="community"
                                            value={soc.id}
                                            checked={selectedId === soc.id}
                                            onChange={() => setSelectedId(soc.id)}
                                            className="campus-radio"
                                        />
                                        <div className="campus-option-content" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.75rem' }}>
                                            <span className="material-symbols-outlined campus-icon">location_city</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
                                                <span className="campus-name" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{soc.name}</span>
                                                {soc.distance !== undefined ? (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                        {soc.distance.toFixed(1)} km away
                                                    </span>
                                                ) : (
                                                    soc.pincode && (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            Pincode: {soc.pincode}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                            {selectedId === soc.id && (
                                                <span className="material-symbols-outlined check-icon fill">check_circle</span>
                                            )}
                                        </div>
                                    </label>
                                ))
                            ) : (
                                <div className="no-communities-state" style={{
                                    padding: '2.5rem 1.5rem',
                                    textAlign: 'center',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', opacity: 0.7 }}>location_off</span>
                                    <p className="font-semibold text-sm text-[var(--text-main)]">No communities found nearby</p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>There are no registered communities near your location yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: 'var(--border)', width: '100%' }}></div>

                        {/* Add New Section at the bottom of the box */}
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.02)' }}>
                            {isAddingNew ? (
                                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                    <input 
                                        type="text"
                                        placeholder="Enter community name..."
                                        value={newCommunityName}
                                        onChange={(e) => setNewCommunityName(e.target.value)}
                                        className="flex-1 px-3 py-1.5 border rounded-lg text-xs"
                                        style={{ 
                                            borderColor: 'var(--border)', 
                                            background: 'var(--surface)',
                                            color: 'var(--text-main)',
                                            outline: 'none'
                                        }}
                                        autoFocus
                                    />
                                    <button 
                                        onClick={() => handleAddNew(newCommunityName)}
                                        disabled={actionLoading || !newCommunityName.trim()}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                                        style={{ 
                                            background: 'var(--primary)',
                                            opacity: (!newCommunityName.trim() || actionLoading) ? 0.6 : 1 
                                        }}
                                    >
                                        Add
                                    </button>
                                    <button 
                                        onClick={() => { setIsAddingNew(false); setNewCommunityName(''); }}
                                        className="px-2 py-1.5 border rounded-lg text-xs text-gray-500 hover:bg-gray-100"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => setIsAddingNew(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        width: '100%'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>add_circle</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <p className="text-[11px] text-gray-400 font-medium leading-tight">Can't find your community?</p>
                                            <p className="text-[13px] font-bold text-gray-700 leading-tight">Add new community</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '16px' }}>arrow_forward_ios</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Continue button */}
                    {selectedId && (
                        <div style={{ marginTop: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                            <button
                                className="campus-cta-btn active"
                                onClick={handleContinue}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Saving...' : 'Continue to FixBee'}
                            </button>
                        </div>
                    )}

                    {/* OR / Sign In link */}
                    <div className="campus-signin-link" style={{ paddingBottom: '2rem' }}>
                        <span className="signin-or">or</span>
                        <p className="signin-text">
                            Already have an account?{' '}
                            <button className="btn-link" onClick={() => navigate('/signin')}>Sign In</button>
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="brand-footer">
                        <p>The Hub of Community Issues • Safe &amp; Secure</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityStep;
