import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

/* ── helpers ── */
function fmtDate(dateStr) {
    if (!dateStr) return '';
    const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'just now';
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CONFIG = {
    open:        { label: 'PENDING',     color: '#f59e0b', bg: '#f59e0b22' },
    in_progress: { label: 'IN PROGRESS', color: '#4991ff', bg: '#4991ff22' },
    resolved:    { label: 'RESOLVED',    color: '#10B981', bg: '#10B98122' },
};

/* ── main component ── */
const AdminDashboard = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { issues, updateIssueStatus, deleteIssue } = useIssues();

    const [activeTab, setActiveTab] = useState('reports');
    const [activeFilter, setActiveFilter] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [resolveConfirm, setResolveConfirm] = useState(null);

    // Flag reports state
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [activeReportFilter, setActiveReportFilter] = useState('pending'); // 'all', 'pending', 'resolved'
    const [reportToDelete, setReportToDelete] = useState(null); // { reportId, targetId }
    const [reportToDismiss, setReportToDismiss] = useState(null); // reportId

    // Fetch flag reports in real-time
    useEffect(() => {
        const q = query(collection(db, 'reports'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reportsData = [];
            snapshot.forEach((doc) => {
                reportsData.push({ id: doc.id, ...doc.data() });
            });
            // Sort by createdAt descending
            reportsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            setReports(reportsData);
            setLoadingReports(false);
        }, (error) => {
            console.error("Error loading reports:", error);
            setLoadingReports(false);
        });

        return () => unsubscribe();
    }, []);

    /* ── Access guard ── */
    const isAdmin = userProfile?.role === 'admin' || currentUser?.role === 'admin';
    if (!isAdmin) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', background: '#0f1117' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#ef4444' }}>lock</span>
                </div>
                <h2 style={{ color: '#fff', fontFamily: 'var(--font-outfit)', fontWeight: 800, margin: 0 }}>Access Denied</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', margin: 0 }}>You need admin privileges to view this page.</p>
                <button className="btn-primary" style={{ padding: '0.875rem 2.5rem' }} onClick={() => navigate('/home')}>Go Home</button>
            </div>
        );
    }

    /* ── Derived stats ── */
    const stats = useMemo(() => ({
        total:       issues.length,
        open:        issues.filter(i => i.status === 'open').length,
        in_progress: issues.filter(i => i.status === 'in_progress').length,
        resolved:    issues.filter(i => i.status === 'resolved').length,
    }), [issues]);

    /* ── Category breakdown ── */
    const categoryBreakdown = useMemo(() => {
        const map = {};
        issues.forEach(i => {
            map[i.category] = (map[i.category] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([id, count]) => ({
                id,
                count,
                label: CATEGORIES.find(c => c.id === id)?.label || id,
                icon: CATEGORIES.find(c => c.id === id)?.icon || 'place',
                pct: Math.round((count / issues.length) * 100),
            }));
    }, [issues]);

    /* ── Filtered issues ── */
    const filtered = useMemo(() => {
        if (activeFilter === 'all') return issues;
        return issues.filter(i => i.status === activeFilter);
    }, [issues, activeFilter]);

    /* ── Filtered reports ── */
    const filteredReports = useMemo(() => {
        if (activeReportFilter === 'all') return reports;
        return reports.filter(r => r.status === activeReportFilter);
    }, [reports, activeReportFilter]);

    /* ── Actions ── */
    const handleResolve = (issueId) => {
        updateIssueStatus(issueId, 'resolved');
        setResolveConfirm(null);
    };
    const handleMarkInProgress = (issueId) => {
        updateIssueStatus(issueId, 'in_progress');
    };
    const handleDelete = (issueId) => {
        deleteIssue(issueId);
        setDeleteConfirm(null);
    };

    // Flag report actions
    const handleResolveReportAndDeleteIssue = async (reportId, issueId) => {
        try {
            await deleteIssue(issueId);
            const reportRef = doc(db, 'reports', reportId);
            await updateDoc(reportRef, { status: 'resolved' });
        } catch (error) {
            console.error("Error resolving report and deleting issue:", error);
        }
        setReportToDelete(null);
    };

    const handleDismissReport = async (reportId) => {
        try {
            const reportRef = doc(db, 'reports', reportId);
            await updateDoc(reportRef, { status: 'resolved' });
        } catch (error) {
            console.error("Error dismissing report:", error);
        }
        setReportToDismiss(null);
    };

    /* ── TABS ── */
    const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
    const tabs = [
        { id: 'overview', label: 'Overview', icon: 'grid_view' },
        { id: 'reports',  label: 'Flag Reports',  icon: 'flag', badge: pendingReportsCount },
        { id: 'analytics', label: 'Analytics', icon: 'bar_chart' },
    ];

    return (
        <div style={{ minHeight: '100dvh', background: '#0f1117', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-outfit, Inter, sans-serif)' }}>

            {/* ── Delete Confirm Modal ── */}
            {deleteConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ef4444' }}>delete</span>
                            </div>
                            <h3 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Delete Issue?</h3>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>This action cannot be undone.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Resolve Confirm Modal ── */}
            {resolveConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#10B981' }}>check_circle</span>
                            </div>
                            <h3 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Mark as Resolved?</h3>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>This will mark the issue as resolved and notify the reporter.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setResolveConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                            <button onClick={() => handleResolve(resolveConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#10B981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Resolve</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Flag Report Delete Modal ── */}
            {reportToDelete && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ef4444' }}>delete</span>
                            </div>
                            <h3 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Remove Listing?</h3>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>This will delete the reported issue and mark the flag report as resolved.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setReportToDelete(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                            <button onClick={() => handleResolveReportAndDeleteIssue(reportToDelete.reportId, reportToDelete.targetId)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Remove & Resolve</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Flag Report Dismiss Modal ── */}
            {reportToDismiss && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(73,145,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#4991ff' }}>info</span>
                            </div>
                            <h3 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Dismiss Flag?</h3>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>This will mark the flag report as resolved and keep the listing active.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setReportToDismiss(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                            <button onClick={() => handleDismissReport(reportToDismiss)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#4991ff', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Dismiss</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div style={{ padding: '16px 20px 0', paddingTop: 'calc(var(--safe-area-top) + 16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>arrow_back</span>
                    </button>

                    {/* Logo area */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #4991ff, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>shield</span>
                        </div>
                        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', margin: 0, fontFamily: 'var(--font-outfit)' }}>Admin Console</h1>
                    </div>

                    {/* Admin badge */}
                    <div style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#a78bfa' }}>verified</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin</span>
                    </div>
                </div>

                {/* ── Tab bar ── */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 0, gap: 0 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '10px 8px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid #4991ff' : '2px solid transparent',
                                color: activeTab === tab.id ? '#4991ff' : '#64748b',
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 5,
                                transition: 'all 0.15s',
                                position: 'relative',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{tab.icon}</span>
                            <span>{tab.label}</span>
                            {tab.badge > 0 && (
                                <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>

                {/* ──── OVERVIEW TAB ──── */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Stat cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { label: 'Total Listings', value: stats.total, color: '#4991ff', bg: '#4991ff15', icon: 'list_alt' },
                                { label: 'Pending Flags',  value: pendingReportsCount, color: '#ef4444', bg: '#ef444415', icon: 'flag' },
                                { label: 'Active Issues',  value: stats.open + stats.in_progress, color: '#f59e0b', bg: '#f59e0b15', icon: 'pending_actions' },
                                { label: 'Resolved Issues',value: stats.resolved,    color: '#10B981', bg: '#10B98115', icon: 'check_circle' },
                            ].map(s => (
                                <div key={s.label} style={{ borderRadius: 16, padding: '16px', background: s.bg, border: `1px solid ${s.color}25`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Resolution rate */}
                        <div style={{ borderRadius: 16, padding: 16, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.9rem' }}>Resolution Rate</span>
                                <span style={{ color: '#10B981', fontWeight: 800, fontSize: '1.1rem' }}>
                                    {stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                                </span>
                            </div>
                            <div style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 8, background: 'linear-gradient(90deg, #10B981, #34d399)', width: `${stats.total ? (stats.resolved / stats.total) * 100 : 0}%`, transition: 'width 0.6s ease' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                                {[
                                    { label: 'Resolved', value: stats.resolved, color: '#10B981' },
                                    { label: 'Pending',  value: stats.open,     color: '#f59e0b' },
                                    { label: 'Active',   value: stats.in_progress, color: '#4991ff' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.label}: <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent activity */}
                        <div style={{ borderRadius: 16, padding: 16, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.9rem', margin: '0 0 12px' }}>Recent Activity</p>
                            {issues.slice(0, 5).map(issue => {
                                const cfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
                                return (
                                    <div key={issue.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: cfg.color }}>flag</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.82rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</p>
                                            <p style={{ color: '#475569', fontSize: '0.7rem', margin: 0 }}>by {issue.reporterName} · {timeAgo(issue.createdAt)}</p>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                                    </div>
                                );
                            })}
                            {issues.length === 0 && <p style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '12px 0' }}>No reports yet</p>}
                        </div>
                    </div>
                )}

                {/* ──── REPORTS TAB ──── */}
                {activeTab === 'reports' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Section header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4991ff' }}>flag</span>
                            <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>Removal Flag Requests</span>
                            <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: '#ef444420', border: '1px solid #ef444430', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{pendingReportsCount}</span>
                        </div>

                        {/* Filter pills */}
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                            {[
                                { id: 'all', label: 'All Reports' },
                                { id: 'pending', label: 'Pending Action' },
                                { id: 'resolved', label: 'Resolved' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveReportFilter(f.id)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: 20,
                                        border: activeReportFilter === f.id ? '1px solid #4991ff' : '1px solid rgba(255,255,255,0.08)',
                                        background: activeReportFilter === f.id ? '#4991ff20' : 'transparent',
                                        color: activeReportFilter === f.id ? '#4991ff' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                >{f.label}</button>
                            ))}
                        </div>

                        {/* Loading State */}
                        {loadingReports ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>sync</span>
                                Loading flag reports...
                            </div>
                        ) : (
                            /* Report cards — two columns on wide screens, single on mobile */
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {filteredReports.map(report => {
                                    const isPending = report.status === 'pending';
                                    const reportColor = isPending ? '#ef4444' : '#10B981';
                                    const reportBg = isPending ? '#ef444415' : '#10B98115';
                                    return (
                                        <div key={report.id} style={{ borderRadius: 16, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                            {/* Card header */}
                                            <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: reportColor, background: reportBg, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    {report.status || 'PENDING'}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: '#475569', flexShrink: 0 }}>{fmtDate(report.createdAt)}</span>
                                            </div>

                                            {/* Card body */}
                                            <div style={{ padding: '0 14px 10px' }}>
                                                <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                    Reason: {report.reason}
                                                </p>
                                                <p style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 500, margin: '0 0 10px', lineHeight: 1.3 }}>
                                                    "{report.description || 'No additional details provided.'}"
                                                </p>
                                            </div>

                                            {/* Target row */}
                                            <div style={{ margin: '0 14px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#4991ff' }}>feed</span>
                                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <strong style={{ color: '#cbd5e1' }}>Reported Listing: </strong>
                                                    {report.targetName || 'Unknown Issue'}
                                                </span>
                                            </div>

                                            {/* Action buttons */}
                                            <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8, marginTop: 'auto' }}>
                                                <button
                                                    onClick={() => navigate(`/issue/${report.targetId}`)}
                                                    style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                                                    View
                                                </button>

                                                {isPending && (
                                                    <>
                                                        <button
                                                            onClick={() => setReportToDismiss(report.id)}
                                                            style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(73,145,255,0.12)', border: '1px solid rgba(73,145,255,0.25)', color: '#4991ff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                                            title="Keep listing active and dismiss report"
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                                            Dismiss
                                                        </button>
                                                        <button
                                                            onClick={() => setReportToDelete({ reportId: report.id, targetId: report.targetId })}
                                                            style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            title="Delete the reported listing"
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredReports.length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.4 }}>inbox</span>
                                        No flag reports found in this category
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ──── ANALYTICS TAB ──── */}
                {activeTab === 'analytics' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Status distribution */}
                        <div style={{ borderRadius: 16, padding: 16, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.9rem', margin: '0 0 16px' }}>Status Distribution</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[
                                    { label: 'Pending',     value: stats.open,        color: '#f59e0b', icon: 'pending_actions' },
                                    { label: 'In Progress', value: stats.in_progress, color: '#4991ff', icon: 'pending' },
                                    { label: 'Resolved',    value: stats.resolved,    color: '#10B981', icon: 'check_circle' },
                                ].map(item => {
                                    const pct = stats.total ? Math.round((item.value / stats.total) * 100) : 0;
                                    return (
                                        <div key={item.label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: item.color }}>{item.icon}</span>
                                                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>{item.label}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '0.82rem', color: item.color, fontWeight: 800 }}>{item.value}</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>{pct}%</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 6, background: item.color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Category breakdown */}
                        <div style={{ borderRadius: 16, padding: 16, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.9rem', margin: '0 0 16px' }}>Reports by Category</p>
                            {categoryBreakdown.length === 0 && (
                                <p style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '12px 0' }}>No data yet</p>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {categoryBreakdown.map((cat, i) => {
                                    const colors = ['#4991ff', '#8b5cf6', '#10B981', '#f59e0b', '#ef4444', '#06b6d4'];
                                    const color = colors[i % colors.length];
                                    return (
                                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14, color }}>{cat.icon}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{cat.label}</span>
                                                    <span style={{ fontSize: '0.8rem', color, fontWeight: 700 }}>{cat.count}</span>
                                                </div>
                                                <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 5, background: color, width: `${cat.pct}%`, transition: 'width 0.6s ease' }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary card */}
                        <div style={{ borderRadius: 16, padding: 16, background: 'linear-gradient(135deg, rgba(73,145,255,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(73,145,255,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4991ff' }}>insights</span>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Summary</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Avg. Resolution</p>
                                    <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>—</p>
                                </div>
                                <div>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Total Upvotes</p>
                                    <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                                        {issues.reduce((sum, i) => sum + (i.upvotes || 0), 0)}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Pending Rate</p>
                                    <p style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                                        {stats.total ? Math.round((stats.open / stats.total) * 100) : 0}%
                                    </p>
                                </div>
                                <div>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Success Rate</p>
                                    <p style={{ color: '#10B981', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                                        {stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;