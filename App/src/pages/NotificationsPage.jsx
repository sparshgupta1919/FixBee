import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

function timeAgo(dateOrTimestamp) {
    if (!dateOrTimestamp) return 'just now';
    const date = dateOrTimestamp.toDate ? dateOrTimestamp.toDate() : new Date(dateOrTimestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const NotificationsPage = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    const handleNotificationClick = (notif) => {
        if (!notif.read) markAsRead(notif.id);
        
        const isInactiveAlert = notif.type === 'expired' || 
                                notif.title?.toLowerCase().includes('inactive') || 
                                notif.title?.toLowerCase().includes('expired');
                                
        const isWarningAlert = notif.type === 'expiry_warning' || 
                               notif.title?.toLowerCase().includes('expire');

        if (isInactiveAlert) {
            navigate('/profile', { state: { defaultTab: 'inactive' } });
        } else if (isWarningAlert) {
            navigate('/profile', { state: { defaultTab: 'unresolved' } });
        } else if (notif.relatedIssueId) {
            navigate(`/issue/${notif.relatedIssueId}`);
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark overflow-y-auto">
            {/* Header */}
            <div
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60"
                style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
                    style={{ width: '36px', height: '36px' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-main)' }}>arrow_back</span>
                </button>
                <div className="flex-1 flex items-center justify-between">
                    <div>
                        <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-outfit)' }}>Notifications</h1>
                        {unreadCount > 0 && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>{unreadCount} unread</p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs font-semibold text-primary px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full active:scale-95 transition-all">
                            Mark all read
                        </button>
                    )}
                </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 px-4 py-4 flex flex-col gap-2">
                {notifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 py-20">
                        <span className="material-symbols-outlined text-5xl mb-3">notifications_off</span>
                        <p className="font-medium text-sm">You have no notifications yet</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className="flex items-start gap-3 p-3.5 rounded-2xl transition-all cursor-pointer hover:opacity-90 active:scale-[0.98]"
                            style={{
                                background: notif.read ? 'var(--surface)' : `${notif.color || '#4991ff'}08`,
                                border: `1px solid ${notif.read ? 'var(--border)' : `${notif.color || '#4991ff'}25`}`,
                            }}
                        >
                            <div
                                className="flex items-center justify-center rounded-full flex-shrink-0"
                                style={{ width: '40px', height: '40px', background: `${notif.color || '#4991ff'}15` }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: notif.color || '#4991ff', fontVariationSettings: notif.icon === 'schedule' || notif.icon === 'notifications' ? "'FILL' 0" : "'FILL' 1" }}>
                                    {notif.icon || 'notifications'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{notif.title}</p>
                                    {!notif.read && (
                                        <div className="rounded-full flex-shrink-0" style={{ width: '7px', height: '7px', background: notif.color || '#4991ff' }} />
                                    )}
                                </div>
                                <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{notif.body}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{timeAgo(notif.createdAt)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
