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
            {/* Animated background blobs */}
            <div className="landing-blob landing-blob--1" aria-hidden="true" />
            <div className="landing-blob landing-blob--2" aria-hidden="true" />
            <div className="landing-blob landing-blob--3" aria-hidden="true" />

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
