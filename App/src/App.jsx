import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { IssueProvider, useIssues } from './context/IssueContext';
import { NotificationProvider } from './context/NotificationContext';
import BottomNav from './components/BottomNav';
import PageTransition from './components/PageTransition';
import PageLoader from './components/PageLoader';

// Lazy load pages
const LandingPage     = lazy(() => import('./pages/LandingPage'));
const SignInPage      = lazy(() => import('./pages/SignInPage'));
const SignUpPage      = lazy(() => import('./pages/SignUpPage'));
const HomePage        = lazy(() => import('./pages/HomePage'));
const IssueDetailsPage = lazy(() => import('./pages/IssueDetailsPage'));
const ReportIssuePage = lazy(() => import('./pages/ReportIssuePage'));
const ChatListPage    = lazy(() => import('./pages/ChatListPage'));
const ChatPage        = lazy(() => import('./pages/ChatPage'));
const ProfilePage     = lazy(() => import('./pages/ProfilePage'));
const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const MapPage          = lazy(() => import('./pages/MapPage'));

// Layout wrapper — shows BottomNav on main tabs
const AppLayout = ({ children }) => {
    const location = useLocation();
    const pagesWithNav = ['/home', '/chats', '/profile', '/map'];
    const showBottomNav = pagesWithNav.some(p => location.pathname === p || location.pathname.startsWith(p));
    const { backgroundTasks, duplicateAlert, dismissDuplicateAlert } = useIssues();

    return (
        <>
            <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark" style={{ overflow: 'hidden', position: 'relative' }}>
                {children}

                {/* Global Background Tasks Notification Banner */}
                {backgroundTasks && backgroundTasks.length > 0 && (
                    <div className="absolute top-4 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                        {backgroundTasks.map(task => (
                            <div
                                key={task.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border border-white/10 text-white backdrop-blur-xl animate-slideDown pointer-events-auto"
                                style={{
                                    background: task.status === 'success' 
                                        ? 'rgba(16,185,129,0.95)' 
                                        : task.status === 'error' 
                                        ? 'rgba(239,68,68,0.95)' 
                                        : 'rgba(59,130,246,0.95)',
                                }}
                            >
                                {task.status === 'running' && (
                                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                )}
                                {task.status === 'success' && (
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                )}
                                {task.status === 'error' && (
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                                )}
                                <span className="text-xs font-semibold">{task.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {showBottomNav && <BottomNav />}

            {/* Duplicate Alert Popup */}
            {duplicateAlert && (
                <div
                    className="fixed z-[10000] animate-slideUp"
                    style={{
                        bottom: showBottomNav ? '80px' : '24px',
                        left: '12px',
                        right: '12px',
                    }}
                >
                    <div
                        style={{
                            background: 'linear-gradient(135deg, rgba(30,20,5,0.97) 0%, rgba(45,28,5,0.97) 100%)',
                            border: '1.5px solid rgba(245,158,11,0.5)',
                            borderRadius: '20px',
                            padding: '16px',
                            boxShadow: '0 8px 32px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '10px',
                                    background: 'rgba(245,158,11,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#F59E0B' }}>content_copy</span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B', letterSpacing: '0.02em' }}>
                                    Possible Duplicate Detected
                                </span>
                            </div>
                            <button
                                onClick={dismissDuplicateAlert}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                                    background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}>close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                            Your report may already be covered by an open issue:
                        </p>
                        <div style={{
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.25)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                        }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#FCD34D', margin: 0 }}>
                                "{duplicateAlert.matchedTitle}"
                            </p>
                        </div>
                        {duplicateAlert.reason && (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                                {duplicateAlert.reason}
                            </p>
                        )}
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', marginBottom: 0 }}>
                            Your report has still been submitted. Consider upvoting the existing issue instead.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

// Global Guard to enforce onboarding
import { useAuth } from './context/AuthContext';
const AuthGuard = ({ children }) => {
    const { currentUser, userProfile, loading } = useAuth();
    const location = useLocation();

    // Public routes bypass all guards — render immediately, no loader
    const publicRoutes = ['/', '/signin', '/signup', '/onboarding'];
    if (publicRoutes.includes(location.pathname)) {
        return children;
    }

    if (loading) return <PageLoader />;

    if (currentUser && userProfile) {
        if (!userProfile.locationGranted && location.pathname !== '/onboarding') {
            return <Navigate to="/onboarding" replace />;
        }
        
        // Gate global chats behind society selection
        if (!userProfile.societyId && location.pathname.startsWith('/chat')) {
            return <Navigate to="/home" replace />;
        }
    }

    return children;
};

function App() {
    return (
        <AuthProvider>
            <IssueProvider>
                <NotificationProvider>
                    <Router>
                        <AuthGuard>
                            <AppLayout>
                                <Suspense fallback={<PageLoader />}>
                                <PageTransition>
                                    <Routes>
                                        <Route path="/"            element={<LandingPage />} />
                                        <Route path="/signin"      element={<SignInPage />} />
                                        <Route path="/signup"      element={<SignUpPage />} />
                                        <Route path="/onboarding"  element={<OnboardingPage />} />
                                        <Route path="/home"        element={<HomePage />} />
                                        <Route path="/issue/:id"   element={<IssueDetailsPage />} />
                                        <Route path="/report"      element={<ReportIssuePage />} />
                                        <Route path="/chats"       element={<ChatListPage />} />
                                        <Route path="/chat/:chatId" element={<ChatPage />} />
                                        <Route path="/profile"     element={<ProfilePage />} />
                                        <Route path="/admin"       element={<AdminDashboard />} />
                                        <Route path="/map"         element={<MapPage />} />
                                        <Route path="/notifications" element={<NotificationsPage />} />
                                        <Route path="*"            element={<Navigate to="/" replace />} />
                                    </Routes>
                                </PageTransition>
                                </Suspense>
                            </AppLayout>
                        </AuthGuard>
                    </Router>
                </NotificationProvider>
            </IssueProvider>
        </AuthProvider>
    );
}

export default App;
