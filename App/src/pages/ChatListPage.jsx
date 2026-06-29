import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIssues } from '../context/IssueContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const ChatListPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { issues, globalPosts, getIssueMessages } = useIssues();
    const [activeTab, setActiveTab] = useState('issues');
    const [activeStatusFilter, setActiveStatusFilter] = useState('all');
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedChats, setPinnedChats] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('pinned_chats') || '[]');
        } catch {
            return [];
        }
    });
    const [activeMenuIssueId, setActiveMenuIssueId] = useState(null);

    useEffect(() => {
        const handleOutsideClick = () => {
            setActiveMenuIssueId(null);
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const handleTogglePin = (issueId, e) => {
        e.stopPropagation();
        setActiveMenuIssueId(null);
        setPinnedChats(prev => {
            const next = prev.includes(issueId)
                ? prev.filter(id => id !== issueId)
                : [...prev, issueId];
            localStorage.setItem('pinned_chats', JSON.stringify(next));
            return next;
        });
    };

    const handleDeleteChat = async (issueId, e) => {
        e.stopPropagation();
        setActiveMenuIssueId(null);
        if (!currentUser) return;
        try {
            const issueRef = doc(db, 'issues', issueId);
            const issueSnap = await getDoc(issueRef);
            if (issueSnap.exists()) {
                const participants = issueSnap.data().chatParticipants || [];
                const updatedParticipants = participants.filter(uid => uid !== currentUser.uid);
                await updateDoc(issueRef, {
                    chatParticipants: updatedParticipants
                });
            }
        } catch (err) {
            console.error("Error leaving/deleting chat:", err);
        }
    };

    const joinedIssues = issues.filter(issue => 
        currentUser && (
            issue.chatParticipants?.includes(currentUser.uid) ||
            issue.reporterId === currentUser.uid
        ) && (
            // Exclude inactive reports (older than 10 days)
            Date.now() - new Date(issue.createdAt).getTime() < 10 * 24 * 60 * 60 * 1000
        )
    );

    const filteredIssues = (() => {
        let list = joinedIssues;
        if (activeStatusFilter !== 'all') {
            list = list.filter(issue => issue.status === activeStatusFilter);
        }
        if (searchQuery.trim()) {
            list = list.filter(issue => issue.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return list;
    })();

    const sortedIssues = [...filteredIssues].sort((a, b) => {
        const isPinnedA = pinnedChats.includes(a.id);
        const isPinnedB = pinnedChats.includes(b.id);
        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        const msgsA = getIssueMessages(a.id);
        const msgsB = getIssueMessages(b.id);
        const lastMsgA = msgsA[msgsA.length - 1];
        const lastMsgB = msgsB[msgsB.length - 1];
        const timeA = lastMsgA ? new Date(lastMsgA.createdAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = lastMsgB ? new Date(lastMsgB.createdAt).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
    });

    // Check if a given chat has unread messages since user last opened it
    const hasUnread = (chatId) => {
        if (!currentUser) return false;
        if (chatId === 'global') {
            const lastPost = globalPosts?.[0];
            if (!lastPost) return false;
            if (lastPost.authorId === currentUser.uid) return false;
            const lastReadPostId = localStorage.getItem(`lastReadPostId_global_${currentUser.uid}`);
            return lastReadPostId !== lastPost.id;
        }
        const lastMsg = getIssueMessages(chatId).slice(-1)[0];
        if (!lastMsg) return false;
        // Don't show unread badge for own messages
        if (lastMsg.senderId === currentUser.uid) return false;
        const lastReadMsgId = localStorage.getItem(`lastReadMsgId_${chatId}_${currentUser.uid}`);
        return lastReadMsgId !== lastMsg.id;
    };

    const globalUnread = hasUnread('global');

    return (
        <div 
            className="flex flex-col h-[100dvh] has-bottom-nav overflow-hidden"
            style={{ background: 'var(--chat-list-bg)' }}
        >
            {/* Header */}
            <div
                className="backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60"
                style={{ paddingTop: 'var(--safe-area-top)', flexShrink: 0, background: 'var(--header-bg)' }}
            >
                {showSearch ? (
                    <div className="flex items-center gap-2.5 px-4 py-3 min-h-[52px]">
                        {/* Back Button */}
                        <button
                            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                            className="flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            style={{ width: '32px', height: '32px' }}
                        >
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '20px' }}>arrow_back</span>
                        </button>

                        {/* Search input field */}
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border-0 outline-none text-sm px-3.5 py-1.5 rounded-full"
                            style={{
                                border: '1.5px solid var(--border)',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-display)',
                            }}
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-4 py-3 relative min-h-[52px]">
                        {/* Logo on the left */}
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: 'white', border: '1px solid rgba(73,145,255,0.2)', zIndex: 10 }}>
                            <img src="/fixbee-logo.svg" alt="FixBee" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div> 

                        {/* Centered Title */}
                        <h1 className="absolute left-1/2 transform -translate-x-1/2 font-bold" style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontFamily: 'var(--font-outfit)' }}>
                            Messages
                        </h1>

                        {/* Search Icon */}
                        <button
                            onClick={() => setShowSearch(true)}
                            className="flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            style={{ width: '32px', height: '32px' }}
                        >
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '22px' }}>search</span>
                        </button>
                    </div>
                )}

                {/* Tab bar */}
                <div className="tab-bar" style={{ background: 'transparent' }}>
                    <button
                        className={`tab-bar-btn ${activeTab === 'issues' ? 'active' : ''}`}
                        onClick={() => setActiveTab('issues')}
                    >
                        <span className="flex items-center justify-center gap-1.5 relative">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
                            Issue Chats
                            {joinedIssues.some(issue => hasUnread(issue.id)) && (
                                <span className="absolute -top-1.5 -right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                            )}
                        </span>
                    </button>
                    <button
                        className={`tab-bar-btn ${activeTab === 'global' ? 'active' : ''}`}
                        onClick={() => navigate('/chat/global')}
                    >
                        <span className="flex items-center justify-center gap-1.5 relative">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>public</span>
                            Global Chat
                            {globalUnread && (
                                <span className="absolute -top-1.5 -right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                            )}
                        </span>
                    </button>
                </div>

                {/* Status filter chips for issue chats */}
                {activeTab === 'issues' && (
                    <div className="flex gap-3.5 px-4 pt-3 pb-3 overflow-x-auto scrollbar-hide">
                        {[
                            { label: 'All', key: 'all' },
                            { label: 'Open', key: 'open' },
                            { label: 'In Progress', key: 'in_progress' },
                            { label: 'Resolved', key: 'resolved' }
                        ].map(chip => {
                            const isActive = activeStatusFilter === chip.key;
                            return (
                                <button
                                    key={chip.key}
                                    onClick={() => setActiveStatusFilter(chip.key)}
                                    className={`px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0 text-xs font-bold font-display ${
                                        isActive
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-2">
                    {sortedIssues.map(issue => {
                        const issueMsgs = getIssueMessages(issue.id);
                        const lastMsg = issueMsgs[issueMsgs.length - 1];
                        
                        let innerBox = null;
                        if (lastMsg) {
                            const sender = lastMsg.senderId === currentUser?.uid ? "You" : lastMsg.senderName;
                            let content = "";
                            if (lastMsg.text) {
                                content = lastMsg.text;
                            } else if (lastMsg.imageURLs && lastMsg.imageURLs.length > 0) {
                                content = lastMsg.imageURLs.length === 1 ? "📷 Photo" : `📷 ${lastMsg.imageURLs.length} Photos`;
                            } else if (lastMsg.videoURL) {
                                content = "🎥 Video";
                            }
                            
                            innerBox = (
                                <div 
                                    className="mt-1.5 py-1.5 px-2.5 rounded-xl flex flex-col gap-0.5 border"
                                    style={{ 
                                        background: 'var(--background)',
                                        borderColor: 'var(--border)'
                                    }}
                                >
                                    <p className="text-xs font-medium line-clamp-1" style={{ color: 'var(--text-main)', lineHeight: 1.3 }}>
                                        <span className="font-normal">{sender}:</span> {content}
                                    </p>
                                    <span className="text-[0.68rem] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        {timeAgo(lastMsg.createdAt)}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={issue.id}
                                onClick={() => navigate(`/chat/${issue.id}`)}
                                className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all active:scale-98"
                                style={{ 
                                    background: issue.chatClosed ? 'var(--background)' : 'var(--surface)', 
                                    border: '1px solid var(--border)',
                                    opacity: issue.chatClosed ? 0.75 : 1
                                }}
                            >
                                {/* Thumbnail */}
                                {issue.imageURLs?.[0] ? (
                                    <img src={issue.imageURLs[0]} alt="" className="rounded-xl flex-shrink-0" style={{ width: '52px', height: '52px', objectFit: 'cover' }} />
                                ) : (
                                    <div className="rounded-xl flex-shrink-0 flex items-center justify-center" style={{ width: '52px', height: '52px', background: 'rgba(73,145,255,0.1)' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#4991ff' }}>location_on</span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-medium line-clamp-1 text-sm flex-1" style={{ color: 'var(--text-main)' }}>{issue.title}</p>
                                        {hasUnread(issue.id) && (
                                            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 ring-2 ring-white dark:ring-slate-900" />
                                        )}
                                        {pinnedChats.includes(issue.id) && (
                                            <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: '13px', transform: 'rotate(45deg)', fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                                        )}
                                    </div>
                                    {innerBox ? innerBox : (
                                        <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            {issue.chatClosed ? '🔒 Discussion closed' : 'Open conversation...'}
                                        </p>
                                    )}
                                </div>

                                <div className="relative flex-shrink-0 z-40" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuIssueId(prev => prev === issue.id ? null : issue.id);
                                        }}
                                        className="flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        style={{ width: '32px', height: '32px' }}
                                    >
                                        <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '20px' }}>more_horiz</span>
                                    </button>

                                    {/* Dropdown Menu Popup */}
                                    {activeMenuIssueId === issue.id && (
                                        <div 
                                            className="absolute right-0 mt-1 w-24 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50 animate-fadeIn"
                                            style={{ top: '100%', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))' }}
                                        >
                                            <button
                                                onClick={(e) => handleTogglePin(issue.id, e)}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                                            >
                                                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '14px' }}>push_pin</span>
                                                <span>{pinnedChats.includes(issue.id) ? 'Unpin' : 'Pin'}</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteChat(issue.id, e)}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-left"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredIssues.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center opacity-60 text-center px-4">
                            <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">forum</span>
                            <p className="font-semibold text-sm text-[#0d1b12] dark:text-white mb-1">No chats found</p>
                            <p className="text-xs text-slate-500 max-w-[240px]">
                                {searchQuery.trim() ? 'No discussions match your search query.' : 'Go to an issue\'s details page and click "Join Conversation" to participate.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatListPage;
