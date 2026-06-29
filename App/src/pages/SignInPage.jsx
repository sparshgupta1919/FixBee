import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import fixbeeLogo from '../assets/signin/honeycomb.svg';
import './SignInPage.css';

const SignInPage = () => {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

    const showToast = (message, type = 'info') => setToast({ visible: true, message, type });

    const isFormComplete = email.trim() !== '' && password.trim() !== '';

    const handleEmailSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password);
            navigate('/home', { replace: true });
        } catch (err) {
            setError(err.message || 'Sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            await signInWithGoogle();
            navigate('/home', { replace: true });
        } catch (err) {
            setError('Google sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="signin-safe-shield" aria-hidden="true" />
            <div className="signin-page">
                {/* Background decorative shapes */}
                <div className="bg-decoration top-right"></div>
                <div className="bg-decoration bottom-left"></div>
                <div className="bg-shape shape-1" aria-hidden="true"></div>
                <div className="bg-shape shape-2" aria-hidden="true"></div>
                <div className="bg-shape shape-3" aria-hidden="true"></div>
                <div className="bg-shape shape-4" aria-hidden="true"></div>
                <div className="bg-shape shape-5" aria-hidden="true"></div>
                <div className="bg-shape shape-6" aria-hidden="true"></div>
                <div className="bg-shape shape-7" aria-hidden="true"></div>
                <div className="bg-shape shape-8" aria-hidden="true"></div>
                <div className="bg-shape shape-9" aria-hidden="true"></div>
                <div className="bg-shape shape-10" aria-hidden="true"></div>

                <div className="signin-container">
                    {/* Header */}
                    <div className="signin-header">
                        <button className="btn-back" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/home', { replace: true })}>
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="signin-content">
                        {/* Logo */}
                        <div className="signin-logo">
                            <div className="logo-icon">
                                <img src={fixbeeLogo} alt="FixBee" className="w-full h-full object-contain p-2" />
                            </div>
                        </div>
                        <h1 className="signin-title">
                            <span className="signin-title-sub">Fix your community</span>
                            <span className="signin-title-main">together.</span>
                        </h1>

                        {/* Auth Form */}
                        <form className="auth-form" onSubmit={handleEmailSignIn}>
                            <div className="auth-card">
                                {error && (
                                    <div className="error-message">
                                        <div className="error-main-msg">{error}</div>
                                    </div>
                                )}

                                {/* Google */}
                                <button type="button" className="btn-google" onClick={handleGoogleSignIn} disabled={loading}>
                                    <div className="google-icon">
                                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                    </div>
                                    <span>Continue with Google</span>
                                </button>

                                <div className="auth-divider"><span>OR</span></div>

                                {/* Email */}
                                <div className="labeled-input-group">
                                    <label className="input-label">EMAIL ADDRESS</label>
                                    <div className="input-with-icon">
                                        <span className="material-symbols-outlined input-icon">alternate_email</span>
                                        <input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                            required
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="labeled-input-group">
                                    <div className="input-label-row">
                                        <label className="input-label">PASSWORD</label>
                                    </div>
                                    <div className="input-with-icon">
                                        <span className="material-symbols-outlined input-icon">lock</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                            required
                                            className="input-field"
                                        />
                                        <button type="button" className="btn-toggle-password" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                            <span className="material-symbols-outlined">{showPassword ? 'visibility' : 'visibility_off'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Submit */}
                                <button type="submit" className={`btn-email ${isFormComplete ? 'active' : ''}`} disabled={loading}>
                                    <span className="material-symbols-outlined">mail</span>
                                    <span>{loading ? 'Signing in...' : 'Continue with Email'}</span>
                                </button>
                            </div>

                            {/* Toggle */}
                            <div className="auth-toggle">
                                Don't have an account?{' '}
                                <button type="button" className="btn-link" onClick={() => navigate('/signup')}>Sign Up</button>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="signin-footer">
                            <p className="footer-text">
                                By continuing, you agree to our{' '}
                                <button type="button" className="footer-link inline">Terms of Service</button> and{' '}
                                <button type="button" className="footer-link inline">Privacy Policy</button>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />
        </>
    );
};

export default SignInPage;
