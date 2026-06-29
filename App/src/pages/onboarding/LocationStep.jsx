import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Toast from '../../components/Toast';
import validPincodes from '../../assets/pincodes.json';

import honeycombBg from '../../assets/signin/honeycomb.svg';
import path1Bg from '../../assets/signin/path-1.svg';
import path2Bg from '../../assets/signin/path-2.svg';
import path3Bg from '../../assets/signin/path-3.svg';
import path4Bg from '../../assets/signin/path-4.svg';
import beeSvg from '../../assets/signin/bee.svg';
import './CampusSelectionPage.css';

const LocationStep = ({ onNext }) => {
    const { currentUser } = useAuth();
    const [pincode, setPincode] = useState('');
    const [loading, setLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

    const showToast = (message, type = 'info') => setToast({ visible: true, message, type });

    const saveLocation = async (data) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                ...data,
                locationGranted: true,
            });
            onNext();
        } catch (err) {
            showToast('Failed to save location', 'error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePincodeSubmit = async (e) => {
        e.preventDefault();
        if (pincode.length < 6) {
            showToast('Please enter a 6-digit pincode', 'warning');
            return;
        }

        // Validate against local Indian pincodes database
        const isValid = validPincodes.includes(Number(pincode));
        if (!isValid) {
            showToast('This pincode does not exist in India', 'error');
            return;
        }

        setLoading(true);
        let lat = null;
        let lng = null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`, {
                headers: {
                    'Accept-Language': 'en'
                }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
            }
        } catch (err) {
            console.error('Pincode geocoding failed:', err);
        }

        saveLocation({ pincode, lat, lng });
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'error');
            return;
        }
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                let resolvedPincode = null;
                try {
                    // Query Nominatim reverse geocoding to resolve pincode
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    });
                    const data = await response.json();
                    const rawPostcode = data?.address?.postcode;
                    
                    if (rawPostcode) {
                        // Extract digits only and keep first 6 digits
                        const cleaned = rawPostcode.replace(/\D/g, '');
                        if (cleaned.length >= 6) {
                            resolvedPincode = cleaned.substring(0, 6);
                        }
                    }
                } catch (err) {
                    console.error('Reverse geocoding failed:', err);
                }

                setGeoLoading(false);
                saveLocation({
                    lat,
                    lng,
                    pincode: resolvedPincode
                });
            },
            (error) => {
                setGeoLoading(false);
                if (error.code === error.PERMISSION_DENIED) {
                    showToast('Location access denied. Please use pincode.', 'warning');
                } else {
                    showToast('Could not detect location.', 'error');
                }
            }
        );
    };

    return (
        <div className="campus-selection-page">
            <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />

        <div className="campus-container">
                <div className="campus-content">

                    {/* Honeycomb + bees */}
                    <div className="campus-logo">
                        <div className="honeycomb-hero">
                            <img src={honeycombBg} alt="FixBee" aria-hidden="true" className="honeycomb-icon" />
                            <div className="bee-orbit bee-1"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-2"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-3"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                            <div className="bee-orbit bee-4"><img src={beeSvg} alt="" aria-hidden="true" /></div>
                        </div>
                        <h1 className="campus-title font-semibold">
                            <span className="campus-title-sub">Finding your</span>
                            <span className="campus-title-main">community.</span>
                        </h1>
                    </div>

                    <div className="flex flex-col items-center w-full px-4 mt-4">
                        <div style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '1.25rem',
                            padding: '1.5rem',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}>
                            <button 
                                onClick={handleDetectLocation}
                                disabled={loading || geoLoading}
                                className="w-full btn-primary mb-1.5 relative overflow-hidden group py-3 rounded-xl text-white font-bold transition-all shadow-sm"
                                style={{ backgroundColor: 'var(--primary)' }}
                            >
                                {geoLoading ? (
                                    <div className="spinner mx-auto" style={{ width: '22px', height: '22px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-lg">my_location</span>
                                        Detect Location
                                    </div>
                                )}
                            </button>
                            <p className="text-sm text-gray-500 font-medium mb-3 text-center">(Recommended)</p>

                            <div className="flex items-center w-full gap-4 my-4 opacity-80">
                                <div className="flex-1 h-[1.5px] bg-[var(--border)]"></div>
                                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">OR</span>
                                <div className="flex-1 h-[1.5px] bg-[var(--border)]"></div>
                            </div>

                            <form onSubmit={handlePincodeSubmit} className="flex flex-col gap-3 w-full">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">pin_drop</span>
                                    <input 
                                        type="text"
                                        placeholder="Enter Pincode"
                                        value={pincode}
                                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                                        maxLength={10}
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border text-sm font-medium transition-all focus:outline-none"
                                        style={{ 
                                            background: 'var(--surface)', 
                                            borderColor: 'var(--border)',
                                            color: 'var(--text-main)',
                                        }}
                                        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(73,145,255,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
                                <button 
                                    type="submit"
                                    disabled={loading || pincode.length < 6}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
                                    style={{
                                        background: pincode.length >= 6 ? 'var(--primary)' : 'var(--border)',
                                        color: pincode.length >= 6 ? 'var(--background-light)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {loading ? 'Saving...' : 'Continue with Pincode'}
                                </button>
                            </form>
                        </div>

                        <div className="w-full h-[1.5px] bg-[var(--border)] my-5 opacity-60"></div>
                        <p className="campus-subtitle text-center">
                            We need your location to show you relevant issues and communities nearby.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LocationStep;
