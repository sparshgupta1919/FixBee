import { useNavigate, useLocation } from 'react-router-dom';
import { Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIssues } from '../context/IssueContext';

const HomeIcon = ({ active }) => (
    <svg width="22" height="22" viewBox="-1 -1 18 20" fill={active ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg" className="h-[20px] w-auto">
        <path d="M0 15.5V6.5C0 6.18333 0.0709998 5.88333 0.213 5.6C0.355 5.31667 0.550667 5.08333 0.8 4.9L6.8 0.4C7.15 0.133333 7.55 0 8 0C8.45 0 8.85 0.133333 9.2 0.4L15.2 4.9C15.45 5.08333 15.646 5.31667 15.788 5.6C15.93 5.88333 16.0007 6.18333 16 6.5V15.5C16 16.05 15.804 16.521 15.412 16.913C15.02 17.305 14.5493 17.5007 14 17.5H11C10.7167 17.5 10.4793 17.404 10.288 17.212C10.0967 17.02 10.0007 16.7827 10 16.5V11.5C10 11.2167 9.904 10.9793 9.712 10.788C9.52 10.5967 9.28267 10.5007 9 10.5H7C6.71667 10.5 6.47933 10.596 6.288 10.788C6.09667 10.98 6.00067 11.2173 6 11.5V16.5C6 16.7833 5.904 17.021 5.712 17.213C5.52 17.405 5.28267 17.5007 5 17.5H2C1.45 17.5 0.979333 17.3043 0.588 16.913C0.196666 16.5217 0.000666667 16.0507 0 15.5Z"
            stroke={active ? 'none' : 'currentColor'} strokeWidth="1.3" />
    </svg>
);


const ChatIcon = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[22px] w-auto">
        <path
            d="M21 11.5c0 3.866-4.03 7-9 7-1.012 0-1.983-.131-2.888-.376L5 20l1.248-3.951C4.425 14.864 3 13.257 3 11.5c0-3.866 4.03-7 9-7s9 3.134 9 7z"
            stroke="currentColor"
            strokeWidth={active ? '1.8' : '1.4'}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? 'rgba(73,145,255,0.1)' : 'none'}
        />
        <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
        <circle cx="12" cy="11.5" r="1" fill="currentColor" />
        <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
    </svg>
);

const ProfileIcon = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg" className="h-[20px] w-auto">
        <path d="M12.16 10.87C12.06 10.86 11.94 10.86 11.83 10.87C9.45 10.79 7.56 8.84 7.56 6.44C7.56 3.99 9.54 2 12 2C14.45 2 16.44 3.99 16.44 6.44C16.43 8.84 14.54 10.79 12.16 10.87Z" stroke="currentColor" strokeWidth={active ? '1.5' : '1.8'} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.16 14.56C4.74 16.18 4.74 18.82 7.16 20.43C9.91 22.27 14.42 22.27 17.17 20.43C19.59 18.81 19.59 16.17 17.17 14.56C14.43 12.73 9.92 12.73 7.16 14.56Z" stroke="currentColor" strokeWidth={active ? '1.5' : '1.8'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const MapIcon = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg" className="h-[20px] w-auto">
        <path d="M9 20L3 17V4L9 7L15 4L21 7V20L15 17L9 20Z" stroke="currentColor" strokeWidth={active ? '1.5' : '1.8'} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 7V20" stroke={active ? 'white' : 'currentColor'} strokeWidth={active ? '1.5' : '1.8'} className={active ? 'dark:stroke-slate-800' : ''} />
        <path d="M15 4V17" stroke={active ? 'white' : 'currentColor'} strokeWidth={active ? '1.5' : '1.8'} className={active ? 'dark:stroke-slate-800' : ''} />
    </svg>
);

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    const { userProfile, currentUser } = useAuth();
    const { issues, globalPosts, getIssueMessages } = useIssues();

    // Check if there are any unread messages (global or joined issue chats)
    const joinedIssues = issues.filter(issue => 
        currentUser && (
            issue.chatParticipants?.includes(currentUser.uid) ||
            issue.reporterId === currentUser.uid
        ) && (
            Date.now() - new Date(issue.createdAt).getTime() < 10 * 24 * 60 * 60 * 1000
        )
    );

    const hasUnreadMessages = !!currentUser && (
        // Check global forum
        (() => {
            const lastPost = globalPosts?.[0];
            if (!lastPost) return false;
            if (lastPost.authorId === currentUser.uid) return false;
            const lastReadPostId = localStorage.getItem(`lastReadPostId_global_${currentUser.uid}`);
            return lastReadPostId !== lastPost.id;
        })() ||
        // Check joined issue chats
        joinedIssues.some(issue => {
            const msgs = getIssueMessages(issue.id);
            const lastMsg = msgs[msgs.length - 1];
            if (!lastMsg) return false;
            if (lastMsg.senderId === currentUser.uid) return false;
            const lastReadMsgId = localStorage.getItem(`lastReadMsgId_${issue.id}_${currentUser.uid}`);
            return lastReadMsgId !== lastMsg.id;
        })
    );

    const navItems = [
        { path: '/home', label: 'Home', icon: <HomeIcon active={isActive('/home')} /> },
        ...(userProfile?.societyId ? [{ 
            path: '/chats', 
            label: 'Chats', 
            icon: <ChatIcon active={isActive('/chats')} />,
            hasBadge: hasUnreadMessages
        }] : []),
        { path: '/map', label: 'Map', icon: <MapIcon active={isActive('/map')} /> },
        { path: '/profile', label: 'Profile', icon: <ProfileIcon active={isActive('/profile')} /> },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 px-4 pb-[calc(var(--safe-area-bottom)+0.75rem)] z-40 pointer-events-none">
            <div className="max-w-md mx-auto h-14 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-2xl rounded-full border border-slate-200/50 dark:border-slate-800/50 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] flex items-center justify-between p-1.5 gap-1 pointer-events-auto">
                {navItems.map((item, index) => {
                    const active = isActive(item.path);
                    const nextItem = navItems[index + 1];
                    const showSeparator = nextItem && !active && !isActive(nextItem.path) && !item.isCenter && !nextItem?.isCenter;

                    if (item.isCenter) {
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className="relative flex items-center justify-center w-11 h-11 rounded-full bg-primary shadow-primary transition-all duration-200 active:scale-95 flex-shrink-0"
                                style={{ boxShadow: '0 4px 14px rgba(73, 145, 255, 0.5)' }}
                            >
                                <span className="text-white" style={{ fontSize: '22px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                </span>
                            </button>
                        );
                    }

                    return (
                        <Fragment key={item.path}>
                            <button
                                onClick={() => navigate(item.path)}
                                className={`relative flex items-center justify-center h-full rounded-full transition-all duration-300 ${active ? 'flex-auto bg-[#EEF2FA] dark:bg-slate-800' : 'flex-1 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                            >
                                <div className={`flex items-center justify-center gap-[6px] px-2 h-full transition-colors duration-300 ${active ? 'text-[#061237] dark:text-white' : 'text-[#A2A2A2]'}`}>
                                    <div className="relative flex-shrink-0 flex items-center justify-center">
                                        {item.hasBadge && (
                                            <span 
                                                className={`absolute -top-1 -right-1 z-10 w-2.5 h-2.5 rounded-full bg-red-500 border-2 ${active ? 'border-[#EEF2FA] dark:border-slate-800' : 'border-white dark:border-surface-dark'}`}
                                            />
                                        )}
                                        {item.icon}
                                    </div>
                                    {active && (
                                        <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap">
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                            </button>
                            {showSeparator && (
                                <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800/50 shrink-0" />
                            )}
                        </Fragment>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
