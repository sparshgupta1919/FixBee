import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    useEffect(() => {
        if (currentUser) {
            navigate('/home', { replace: true });
        }
    }, [currentUser, navigate]);

    return (
        <div className="landing-page">
            {/* ── Background Graphics Layer ── */}

            {/* Dot grid overlay */}
            <div className="lp-dot-grid" aria-hidden="true" />

            {/* Animated background blobs */}
            <div className="landing-blob landing-blob--1" aria-hidden="true" />
            <div className="landing-blob landing-blob--2" aria-hidden="true" />
            <div className="landing-blob landing-blob--3" aria-hidden="true" />
            <div className="landing-blob landing-blob--4" aria-hidden="true" />

            {/* Floating particles */}
            <div className="lp-particle lp-particle--1" aria-hidden="true" />
            <div className="lp-particle lp-particle--2" aria-hidden="true" />
            <div className="lp-particle lp-particle--3" aria-hidden="true" />
            <div className="lp-particle lp-particle--4" aria-hidden="true" />
            <div className="lp-particle lp-particle--5" aria-hidden="true" />
            <div className="lp-particle lp-particle--6" aria-hidden="true" />

            {/* Decorative hexagon shapes */}
            <div className="lp-hex lp-hex--1" aria-hidden="true" />
            <div className="lp-hex lp-hex--2" aria-hidden="true" />

            {/* Corner accent lines */}
            <svg className="lp-corner-svg lp-corner-svg--tl" aria-hidden="true" viewBox="0 0 120 120" fill="none">
                <path d="M120 0 L0 0 L0 120" stroke="url(#lp-grad-tl)" strokeWidth="1.5" strokeDasharray="6 4" />
                <circle cx="0" cy="0" r="6" fill="url(#lp-grad-tl)" opacity="0.6" />
                <defs>
                    <linearGradient id="lp-grad-tl" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#4991ff" stopOpacity="0.8" />
                        <stop offset="1" stopColor="#4991ff" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            <svg className="lp-corner-svg lp-corner-svg--br" aria-hidden="true" viewBox="0 0 120 120" fill="none">
                <path d="M0 120 L120 120 L120 0" stroke="url(#lp-grad-br)" strokeWidth="1.5" strokeDasharray="6 4" />
                <circle cx="120" cy="120" r="6" fill="url(#lp-grad-br)" opacity="0.6" />
                <defs>
                    <linearGradient id="lp-grad-br" x1="120" y1="120" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#4aade8" stopOpacity="0.7" />
                        <stop offset="1" stopColor="#4aade8" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Bottom mesh wave */}
            <svg className="lp-bottom-wave" aria-hidden="true" viewBox="0 0 375 120" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lp-wave-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4991ff" stopOpacity="0.07" />
                        <stop offset="100%" stopColor="#4991ff" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d="M0 60 Q45 20 90 55 T180 50 T270 60 T375 45 L375 120 L0 120 Z" fill="url(#lp-wave-fill)" />
                <path d="M0 80 Q60 50 120 75 T240 65 T375 70" stroke="rgba(73,145,255,0.12)" strokeWidth="1.5" fill="none" />
            </svg>

            {/* Top: Logo + Title */}
            <div className="landing-top">
                <div className="landing-logo-wrap">
                    <div className="landing-logo-ring" aria-hidden="true" />
                    <div className="landing-logo">
                        <img src="/fixbee-logo.svg" alt="FixBee" />
                    </div>
                </div>

                <h1 className="landing-title">
                    <span className="landing-title-sub">Fix Your</span>
                    <br />
                    <span className="landing-title-main">Community</span>
                </h1>
                <p className="landing-subtitle">
                    Report • Verify • Resolve — Together
                </p>
            </div>

            {/* Middle: Feature cards */}
            <div className="landing-features">
                <div className="feature-card">
                    <div className="feature-icon-wrap green-wrap">
                        <span className="material-symbols-outlined fill feature-icon green" style={{ fontVariationSettings: "'FILL' 1" }}>
                            camera_alt
                        </span>
                    </div>
                    <h3 className="feature-title">Photo Reports</h3>
                    <p className="feature-description">Snap & submit issues with location</p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon-wrap orange-wrap">
                        <span className="material-symbols-outlined fill feature-icon orange" style={{ fontVariationSettings: "'FILL' 1" }}>
                            thumb_up
                        </span>
                    </div>
                    <h3 className="feature-title">Community Vote</h3>
                    <p className="feature-description">Upvote to prioritize urgent issues</p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon-wrap primary-wrap">
                        <span className="material-symbols-outlined fill feature-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            verified
                        </span>
                    </div>
                    <h3 className="feature-title">Track & Resolve</h3>
                    <p className="feature-description">Follow issues from report to fix</p>
                </div>
            </div>

            {/* Bottom: CTA */}
            <div className="landing-cta">
                <button
                    className="btn-primary btn-large btn-enhanced"
                    onClick={() => navigate('/signin')}
                >
                    Get Started
                </button>
                <p className="landing-footer-text">
                    Free to use&nbsp;•&nbsp;Help your neighborhood
                </p>
            </div>
        </div>
    );
};

export default LandingPage;
