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
    const { backgroundTasks } = useIssues();

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
