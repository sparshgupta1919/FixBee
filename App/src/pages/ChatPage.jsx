import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIssues, CATEGORIES } from '../context/IssueContext';
import { db, storage } from '../firebase';
import { doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const getTimeDivider = (msg, prevMsg) => {
    if (!msg || !msg.createdAt) return null;
    
    const currentDate = new Date(msg.createdAt);
    const currentTimeStr = currentDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    
    if (!prevMsg || !prevMsg.createdAt) {
        const dateStr = currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `${dateStr}, ${currentTimeStr}`.toUpperCase();
    }
    
    const prevDate = new Date(prevMsg.createdAt);
    const prevTimeStr = prevDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    
    const isDifferentDate = currentDate.getDate() !== prevDate.getDate() ||
                            currentDate.getMonth() !== prevDate.getMonth() ||
                            currentDate.getFullYear() !== prevDate.getFullYear();
                            
    if (isDifferentDate) {
        const dateStr = currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `${dateStr}, ${currentTimeStr}`.toUpperCase();
    }
    
    if (currentTimeStr !== prevTimeStr) {
        return currentTimeStr.toUpperCase();
    }
    
    return null;
};

const MessageBubble = ({ msg, isOwn, isLast }) => {
    if (msg.senderId === 'system') {
        return (
            <div className="flex justify-center w-full my-4 animate-fadeIn">
                <div className="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/40 dark:border-slate-700/50 shadow-sm text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[90%] text-center">
                    {msg.text}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            {!isOwn && (
                <div
                    className="flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ width: '28px', height: '28px', background: '#4991ff', alignSelf: 'flex-end' }}
                >
                    {msg.senderPhoto && msg.senderPhoto !== 'null' && msg.senderPhoto !== 'undefined' ? (
                        <img src={msg.senderPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.75rem' }}>
                            {msg.senderName?.[0]?.toUpperCase() || '?'}
                        </span>
                    )}
                </div>
            )}

            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {/* Sender name for others */}
                {!isOwn && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', paddingLeft: '4px' }}>
                        {msg.senderName}
                    </span>
                )}
                {/* Bubble */}
                {(() => {
                    const hasMedia = (msg.imageURLs && msg.imageURLs.length > 0) || msg.videoURL;
                    return (
                        <div
                            className="rounded-2xl"
                            style={{
                                padding: hasMedia ? '0.375rem' : '0.625rem 0.875rem',
                                background: isOwn ? '#4991ff' : 'var(--surface)',
                                border: isOwn ? 'none' : '1px solid var(--border)',
                                borderBottomRightRadius: isOwn ? '4px' : '16px',
                                borderBottomLeftRadius: isOwn ? '16px' : '4px',
                                boxShadow: isOwn ? '0 2px 8px rgba(73,145,255,0.3)' : 'var(--shadow-sm)',
                            }}
                        >
                            {/* Render Image Grid */}
                            {msg.imageURLs && msg.imageURLs.length > 0 && (
                                <div className={`grid gap-1 ${msg.text ? 'mb-1' : ''} ${msg.imageURLs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-w-[240px]`}>
                                    {msg.imageURLs.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url}
                                            alt=""
                                            className="rounded-xl object-cover w-full h-auto max-h-[160px] cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(url, '_blank')}
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Render Video */}
                            {msg.videoURL && (
                                <div className={msg.text ? 'mb-1' : ''} style={{ maxWidth: '240px' }}>
                                    <video
                                        src={msg.videoURL}
                                        controls
                                        className="rounded-xl w-full max-h-[180px] bg-black"
                                    />
                                </div>
                            )}

                            {msg.text && (
                                <p 
                                    style={{ 
                                        fontSize: '0.9rem', 
                                        color: isOwn ? 'white' : 'var(--text-main)', 
                                        lineHeight: 1.4,
                                        padding: hasMedia ? '0.375rem 0.375rem 0.125rem 0.375rem' : '0'
                                    }}
                                >
                                    {msg.text}
                                </p>
                            )}
                        </div>
                    );
                })()}
                {/* Delivery status for own message (only on the last message) */}
                {isOwn && isLast && (
                    <span 
                        className="text-[9px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-500 uppercase select-none mt-1"
                        style={{ fontFamily: 'var(--font-outfit)', paddingRight: '4px' }}
                    >
                        DELIVERED
                    </span>
                )}
            </div>
        </div>
    );
};

// Component to render the progress-bar voting poll inside issue chats
const ChatVotingWidget = ({ issue, currentUser, onVote, onRefreshVote }) => {
    const [isMinimized, setIsMinimized] = useState(true);

    const participants = issue.chatParticipants || [];
    const participantCount = participants.length;
    const isEnabled = participantCount >= 10;

    const isInactive = Date.now() - new Date(issue.createdAt).getTime() >= 10 * 24 * 60 * 60 * 1000;
    const refreshVotes = issue.refreshVotes || [];
    const hasRefreshVoted = currentUser && refreshVotes.includes(currentUser.uid);
    const refreshThreshold = Math.ceil(participantCount * 0.4);

    if (isInactive) {
        return (
            <div 
                className="mx-4 px-4 py-3 bg-white dark:bg-surface-dark border-x border-b border-slate-100 dark:border-slate-800/80 rounded-b-2xl shadow-sm flex items-center justify-between animate-fadeIn pointer-events-auto"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Inactive Tag */}
                    <div 
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex-shrink-0"
                        style={{
                            color: '#64748b',
                            backgroundColor: 'rgba(100,116,139,0.1)',
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>hourglass_disabled</span>
                        <span>Inactive</span>
                    </div>
                    
                    {/* Divider */}
                    <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700/60" />

                    {/* Poll Summary */}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate">
                            Reactivate Listing
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {isEnabled 
                                ? `Refresh votes: ${refreshVotes.length}/${refreshThreshold} (Needs 40% of members)`
                                : `Locked • Needs 10 members in chat (Current: ${participantCount}/10)`
                            }
                        </p>
                    </div>
                </div>

                {/* Refresh Button */}
                <button
                    disabled={!isEnabled || !currentUser || hasRefreshVoted}
                    onClick={() => onRefreshVote(issue.id, currentUser.uid)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 border flex items-center gap-1 flex-shrink-0 ${
                        hasRefreshVoted
                            ? 'bg-emerald-500 text-white border-transparent'
                            : !isEnabled || !currentUser
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                            : 'bg-primary text-white border-transparent hover:bg-primary-hover shadow-sm'
                    }`}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {hasRefreshVoted ? 'check' : 'autorenew'}
                    </span>
                    <span>{hasRefreshVoted ? 'Voted' : 'Refresh'}</span>
                </button>
            </div>
        );
    }
    const openVotes = issue.openVotes || [];
    const inProgressVotes = issue.inProgressVotes || [];
    const resolvedVotes = issue.resolvedVotes || [];

    // Threshold is simple majority of participants (or at least 5 if participantCount is 10)
    const threshold = Math.max(5, Math.ceil(participantCount / 2));

    const options = [
        { key: 'open', label: 'Open', votes: openVotes, color: '#ef4444', icon: 'report' },
        { key: 'in_progress', label: 'In Progress', votes: inProgressVotes, color: '#f59e0b', icon: 'pending' },
        { key: 'resolved', label: 'Resolved', votes: resolvedVotes, color: '#10B981', icon: 'check_circle' },
    ];

    const STATUS_CONFIG = {
        open: { label: 'Open', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'report' },
        in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'pending' },
        resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: 'check_circle' },
    };

    const currentStatus = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;

    // Find the leading option in the poll
    const leadingOption = options.reduce((prev, current) => {
        return (current.votes.length > prev.votes.length) ? current : prev;
    }, options[0]);

    const leadingVotesCount = leadingOption.votes.length;
    const totalVotesCast = openVotes.length + inProgressVotes.length + resolvedVotes.length;

    if (isMinimized) {
        return (
            <div 
                onClick={() => setIsMinimized(false)}
                className="mx-4 px-4 py-3 bg-white dark:bg-surface-dark border-x border-b border-slate-100 dark:border-slate-800/80 rounded-b-2xl shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all duration-200 animate-fadeIn pointer-events-auto"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Status Badge */}
                    <div 
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex-shrink-0"
                        style={{
                            color: currentStatus.color,
                            backgroundColor: currentStatus.bg,
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{currentStatus.icon}</span>
                        <span>{currentStatus.label}</span>
                    </div>
                    
                    {/* Divider */}
                    <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700/60" />

                    {/* Poll Summary */}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate">
                            {isEnabled ? "Status Voting Poll" : "Poll Locked"}
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {isEnabled 
                                ? (totalVotesCast === 0 
                                    ? `Active • No votes yet • Majority is ${threshold}` 
                                    : `Active • ${leadingOption.label} leading (${leadingVotesCount}/${threshold} votes)`
                                  )
                                : `Needs 10 chat members to unlock (Current: ${participantCount}/10)`
                            }
                        </p>
                    </div>
                </div>

                {/* Expand Action */}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Vote</span>
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '18px' }}>
                        expand_more
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-4 p-4 bg-white dark:bg-surface-dark border-x border-b border-slate-100 dark:border-slate-800/80 rounded-b-3xl shadow-sm flex flex-col gap-3.5 animate-fadeIn pointer-events-auto">
            {/* Title / Header */}
            <div 
                onClick={() => setIsMinimized(true)}
                className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Status Voting Poll</h3>
                        {/* Status Badge */}
                        <div 
                            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                                color: currentStatus.color,
                                backgroundColor: currentStatus.bg,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>{currentStatus.icon}</span>
                            <span>{currentStatus.label}</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {isEnabled 
                            ? `Active: ${participantCount} members joined • Majority is ${threshold} votes`
                            : `Locked: Needs 10 members to vote (Current: ${participantCount}/10)`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {!isEnabled && (
                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600" style={{ fontSize: '18px' }}>lock</span>
                    )}
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '20px' }}>
                        expand_less
                    </span>
                </div>
            </div>

            {/* Voting Options */}
            <div className="flex flex-col gap-3">
                {options.map(opt => {
                    const votesList = opt.votes;
                    const count = votesList.length;
                    const hasVoted = currentUser && votesList.includes(currentUser.uid);
                    
                    // Progress percentage relative to the threshold
                    const percentage = Math.min(100, Math.round((count / threshold) * 100));

                    return (
                        <div key={opt.key} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <button
                                    disabled={!isEnabled || !currentUser}
                                    onClick={() => onVote(issue.id, currentUser.uid, opt.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all active:scale-95 border ${
                                        hasVoted
                                            ? 'text-white border-transparent'
                                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                    }`}
                                    style={{
                                        backgroundColor: hasVoted ? opt.color : undefined,
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{opt.icon}</span>
                                    <span>{opt.label}</span>
                                </button>
                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                                    {count} {count === 1 ? 'vote' : 'votes'} ({percentage}%)
                                </span>
                            </div>
                            
                            {/* Progress bar line */}
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800/60 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                    style={{ 
                                        width: `${percentage}%`, 
                                        backgroundColor: opt.color,
                                        opacity: isEnabled ? 1 : 0.4
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Component to render the confirmation poll when reporter marks resolved
const ResolutionConfirmationWidget = ({ issue, currentUser, onConfirm }) => {
    const [isMinimized, setIsMinimized] = useState(true);
    const participants = issue.chatParticipants || [];
    const participantCount = participants.length;
    const votes = issue.resolutionVotes || [];
    const threshold = Math.ceil(participantCount * 0.4);
    const hasVoted = currentUser && votes.includes(currentUser.uid);

    if (isMinimized) {
        return (
            <div 
                onClick={() => setIsMinimized(false)}
                className="mx-4 px-4 py-3 bg-[#fef3c7] dark:bg-amber-950/20 border-x border-b border-amber-200 dark:border-amber-900/50 rounded-b-2xl shadow-sm flex items-center justify-between cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-all duration-200 animate-fadeIn pointer-events-auto"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex-shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>pending_actions</span>
                        <span>Confirm Resolution</span>
                    </div>
                    <div className="w-[1px] h-3.5 bg-amber-200 dark:bg-amber-900/30" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-amber-800 dark:text-amber-300 truncate">
                            Reporter marked resolved
                        </p>
                        <p className="text-[9px] text-amber-600 dark:text-amber-500 truncate mt-0.5">
                            Votes: {votes.length}/{threshold} confirmed (Needs 40%)
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <span className="text-[10px] font-bold text-amber-500">View</span>
                    <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '18px' }}>
                        expand_more
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-4 p-4 bg-[#fef3c7] dark:bg-amber-950/20 border-x border-b border-amber-200 dark:border-amber-900/50 rounded-b-3xl shadow-sm flex flex-col gap-3.5 animate-fadeIn pointer-events-auto">
            <div 
                onClick={() => setIsMinimized(true)}
                className="flex items-center justify-between border-b border-amber-200/50 dark:border-amber-900/30 pb-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">Confirm Resolution</h3>
                        <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>pending_actions</span>
                            <span>Pending</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                        Confirm if the issue has been successfully resolved to close this chat group.
                    </p>
                </div>
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '20px' }}>
                    expand_less
                </span>
            </div>

            <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    <span>Community Confirmation Progress</span>
                    <span>{votes.length}/{threshold} votes ({Math.round((votes.length / (threshold || 1)) * 100)}%)</span>
                </div>
                <div className="w-full h-2.5 bg-amber-100 dark:bg-amber-950/40 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (votes.length / (threshold || 1)) * 100)}%` }}
                    />
                </div>
            </div>

            <button
                disabled={!currentUser || hasVoted}
                onClick={() => onConfirm(issue.id, currentUser.uid)}
                className={`w-full py-2.5 rounded-[12px] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-sm ${
                    hasVoted
                        ? 'bg-amber-600 text-white border-transparent cursor-default'
                        : !currentUser
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
            >
                <span className="material-symbols-outlined text-[16px]">
                    {hasVoted ? 'check_circle' : 'thumb_up'}
                </span>
                <span>{hasVoted ? 'Confirmed' : 'Confirm Resolution'}</span>
            </button>
        </div>
    );
};

// Modal to show all joined chat participants
const ParticipantsModal = ({ isOpen, onClose, participants, loading }) => {
    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose} 
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
        >
            <div 
                onClick={(e) => e.stopPropagation()} 
                className="w-full max-w-[280px] bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-scaleIn flex flex-col max-h-[70vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex-shrink-0">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white font-outfit">Members Joined</h3>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-hide">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '24px' }}>progress_activity</span>
                            <span className="text-xs font-semibold">Loading members...</span>
                        </div>
                    ) : participants.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                            No members found.
                        </div>
                    ) : (
                        participants.map(member => (
                            <div key={member.uid} className="flex items-center gap-3 py-1.5 border-b border-slate-50 dark:border-slate-800/30 last:border-0">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {member.photoURL && member.photoURL !== 'null' && member.photoURL !== 'undefined' ? (
                                        <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-extrabold text-white">
                                            {member.name?.[0]?.toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>
                                {/* Name */}
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-display truncate">
                                    {member.name}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const ChatPage = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { issues, globalPosts, createGlobalPost, upvoteGlobalPost, addGlobalComment, sendIssueMessage, voteOnIssueStatus, voteToRefreshIssue, voteToConfirmResolution, getIssueMessages } = useIssues();

    // Global Forum Specific States
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentInput, setCommentInput] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [replyingToCommentId, setReplyingToCommentId] = useState(null);
    const [replyInput, setReplyInput] = useState('');
    
    // Create Post Form States
    const [postTitle, setPostTitle] = useState('');
    const [postDescription, setPostDescription] = useState('');
    const [postFiles, setPostFiles] = useState([]);
    const [postPreviews, setPostPreviews] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    
    // Search query for posts
    const [forumSearchQuery, setForumSearchQuery] = useState('');

    const handlePostFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setPostFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => ({
                url: URL.createObjectURL(file),
                type: 'image',
                name: file.name
            }));
            setPostPreviews(prev => [...prev, ...newPreviews]);
        }
    };
    
    const handleRemovePostFile = (indexToRemove) => {
        setPostFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setPostPreviews(prev => {
            URL.revokeObjectURL(prev[indexToRemove].url);
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
    };

    const handleCreatePost = async () => {
        if (!postTitle.trim() || !postDescription.trim() || !currentUser) return;
        setIsPosting(true);
        try {
            await createGlobalPost(postTitle.trim(), postDescription.trim(), currentUser, postFiles);
            setPostTitle('');
            setPostDescription('');
            postPreviews.forEach(p => URL.revokeObjectURL(p.url));
            setPostPreviews([]);
            setPostFiles([]);
            setIsCreateModalOpen(false);
        } catch (err) {
            console.error("Error creating post:", err);
        } finally {
            setIsPosting(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentInput.trim() || !currentUser || !selectedPostId) return;
        const text = commentInput.trim();
        setCommentInput('');
        try {
            await addGlobalComment(selectedPostId, text, currentUser);
        } catch (err) {
            console.error("Error adding comment:", err);
        }
    };

    const handleSendReply = async (parentCommentId) => {
        if (!replyInput.trim() || !currentUser || !selectedPostId) return;
        const text = replyInput.trim();
        setReplyInput('');
        setReplyingToCommentId(null);
        try {
            await addGlobalComment(selectedPostId, text, currentUser, parentCommentId);
        } catch (err) {
            console.error("Error adding reply:", err);
        }
    };

    useEffect(() => {
        setReplyingToCommentId(null);
        setReplyInput('');
        if (chatId !== 'global' || !selectedPostId) {
            setComments([]);
            return;
        }
        
        const q = query(
            collection(db, `global_posts/${selectedPostId}/comments`),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
            }));
            setComments(data);
        });
        return unsubscribe;
    }, [chatId, selectedPostId]);

    useEffect(() => {
        return () => {
            postPreviews.forEach(p => URL.revokeObjectURL(p.url));
        };
    }, [postPreviews]);

    // Mark global forum as read
    const lastPostId = globalPosts?.[0]?.id;
    useEffect(() => {
        if (currentUser && chatId === 'global' && lastPostId) {
            localStorage.setItem(`lastReadPostId_global_${currentUser.uid}`, lastPostId);
        }
    }, [chatId, currentUser, lastPostId]);



    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => ({
                url: URL.createObjectURL(file),
                type: file.type.startsWith('video/') ? 'video' : 'image',
                name: file.name
            }));
            setPreviewUrls(prev => [...prev, ...newPreviews]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setPreviewUrls(prev => {
            URL.revokeObjectURL(prev[indexToRemove].url);
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
    };

    // Cleanup preview URLs on unmount/change
    useEffect(() => {
        return () => {
            previewUrls.forEach(preview => URL.revokeObjectURL(preview.url));
        };
    }, [previewUrls]);

    const isGlobal = chatId === 'global';
    const issue = !isGlobal ? issues.find(i => i.id === chatId) : null;
    const messages = !isGlobal ? getIssueMessages(chatId) : [];

    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [participantsList, setParticipantsList] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    useEffect(() => {
        if (!isParticipantsModalOpen || isGlobal || !issue?.chatParticipants) return;

        const fetchParticipants = async () => {
            setLoadingParticipants(true);
            try {
                const uids = issue.chatParticipants || [];
                const fetchedUsers = [];
                for (const uid of uids) {
                    const userDocRef = doc(db, 'users', uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        fetchedUsers.push({
                            uid,
                            name: data.displayName || data.display_name || 'Anonymous User',
                            photoURL: data.photoURL || ''
                        });
                    } else {
                        fetchedUsers.push({
                            uid,
                            name: 'Anonymous User',
                            photoURL: ''
                        });
                    }
                }
                setParticipantsList(fetchedUsers);
            } catch (err) {
                console.error("Error fetching chat participants:", err);
            } finally {
                setLoadingParticipants(false);
            }
        };

        fetchParticipants();
    }, [isParticipantsModalOpen, isGlobal, issue?.chatParticipants]);

    const [societyName, setSocietyName] = useState('');

    useEffect(() => {
        if (!issue?.societyId) {
            setSocietyName('');
            return;
        }

        const fetchSocietyName = async () => {
            try {
                const docRef = doc(db, 'societies', issue.societyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSocietyName(docSnap.data().name);
                }
            } catch (err) {
                console.error('Error fetching society name:', err);
            }
        };

        fetchSocietyName();
    }, [issue?.societyId]);

    const title = isGlobal ? 'Global Community Chat' : (issue?.title || 'Issue Chat');
    const subtitle = isGlobal 
        ? 'Everyone can chat here' 
        : (societyName || issue?.location || '');

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Mark chat as read — store last read message ID so badge clears dynamically
    const lastMsgId = messages[messages.length - 1]?.id;
    useEffect(() => {
        if (currentUser && chatId && lastMsgId) {
            localStorage.setItem(`lastReadMsgId_${chatId}_${currentUser.uid}`, lastMsgId);
        }
    }, [chatId, currentUser, lastMsgId]);

    // Participant tracking for locked/unlocked chat voting
    useEffect(() => {
        if (currentUser && !isGlobal && issue) {
            const participants = issue.chatParticipants || [];
            if (!participants.includes(currentUser.uid)) {
                const issueRef = doc(db, 'issues', issue.id);
                updateDoc(issueRef, {
                    chatParticipants: [...participants, currentUser.uid]
                }).catch(err => console.error("Error adding chat participant:", err));
            }
        }
    }, [currentUser, isGlobal, issue]);

    const handleSend = async () => {
        const textToSend = inputText.trim();
        const filesToSend = [...selectedFiles];
        const previewsToClear = [...previewUrls];

        if ((!textToSend && filesToSend.length === 0) || !currentUser) return;

        // Optimistically clear the input fields immediately so it feels instant
        setInputText('');
        setSelectedFiles([]);
        setPreviewUrls([]);

        // Only block/load if there are actual media files to upload
        const hasMedia = filesToSend.length > 0;
        if (hasMedia) {
            setIsUploadingMedia(true);
        }

        const sendMsgPromise = (async () => {
            try {
                let uploadedImageURLs = [];
                let uploadedVideoURL = null;

                if (filesToSend.length > 0) {
                    const uploadPromises = filesToSend.map(async (file, idx) => {
                        const fileExtension = file.name.split('.').pop() || 'jpg';
                        const isVideo = file.type.startsWith('video/');
                        const folder = isVideo ? 'videos' : 'images';
                        const fileName = `chats/${chatId}/${currentUser.uid}-${Date.now()}-${idx}.${fileExtension}`;
                        const storageRef = ref(storage, fileName);
                        const snapshot = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(snapshot.ref);
                        
                        if (isVideo) {
                            if (!uploadedVideoURL) {
                                uploadedVideoURL = downloadURL;
                            }
                        } else {
                            uploadedImageURLs.push(downloadURL);
                        }
                    });

                    await Promise.all(uploadPromises);
                }

                const msg = {
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || 'Anonymous',
                    senderPhoto: (currentUser.photoURL && currentUser.photoURL !== 'null' && currentUser.photoURL !== 'undefined') ? currentUser.photoURL : '',
                    text: textToSend,
                    imageURLs: uploadedImageURLs.length > 0 ? uploadedImageURLs : null,
                    videoURL: uploadedVideoURL || null
                };

                if (isGlobal) {
                    await sendGlobalMessage(msg);
                } else {
                    await sendIssueMessage(chatId, msg);
                }

                // Revoke preview URLs
                previewsToClear.forEach(preview => URL.revokeObjectURL(preview.url));
            } catch (err) {
                console.error("Error sending message:", err);
                alert("Failed to send message. Please try again.");
                // Restore text if send failed so they don't lose their input
                setInputText(textToSend);
                setSelectedFiles(filesToSend);
                setPreviewUrls(previewsToClear);
            } finally {
                if (hasMedia) {
                    setIsUploadingMedia(false);
                    setTimeout(() => {
                        inputRef.current?.focus();
                    }, 50);
                }
            }
        })();

        // If it is just text, do not block the UI or disable input. Refocus immediately.
        if (!hasMedia) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            await sendMsgPromise;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (isGlobal) {
        const selectedPost = selectedPostId ? globalPosts?.find(p => p.id === selectedPostId) : null;
        const filteredPosts = (globalPosts || []).filter(post => {
            if (!forumSearchQuery.trim()) return true;
            const queryText = forumSearchQuery.toLowerCase();
            return (
                post.title?.toLowerCase().includes(queryText) ||
                post.description?.toLowerCase().includes(queryText) ||
                post.authorName?.toLowerCase().includes(queryText)
            );
        });

        return (
            <div className="flex flex-col h-[100dvh] bg-[#eceef2] dark:bg-[#090a15]" style={{ overflow: 'hidden', position: 'relative' }}>
                {selectedPost ? (
                    /* Detailed Post View */
                    <div className="flex flex-col h-full min-h-0 bg-[#eceef2] dark:bg-[#090a15]">
                        {/* Header */}
                        <div 
                            className="relative overflow-hidden flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-[#121324]/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/40 flex-shrink-0"
                            style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
                        >
                            {/* Honeycomb grid overlay */}
                            <div className="absolute right-0 top-0 bottom-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-25">
                                <svg width="120" height="100%" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
                                    <path d="M100 10 L115 18.5 L115 35.5 L100 44 L85 35.5 L85 18.5 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/30 dark:text-amber-400/25" />
                                    <path d="M85 35.5 L100 44 L100 61 L85 69.5 L70 61 L70 44 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/35 dark:text-amber-400/30" />
                                    <path d="M70 10 L85 18.5 L85 35.5 L70 44 L55 35.5 L55 18.5 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/20 dark:text-amber-400/15" />
                                    <path d="M115 35.5 L130 44 L130 61 L115 69.5 L100 61 L100 44 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/20 dark:text-amber-400/15" />
                                </svg>
                            </div>

                            {/* SVG Graphic Scene (Bee, Flower, Grass) */}
                            <div className="absolute right-3 bottom-0 overflow-hidden pointer-events-none select-none w-[120px] h-[45px]">
                                <svg width="120" height="45" viewBox="0 0 120 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M 0 45 Q 10 42 20 45 Q 30 43 40 45 Q 50 42 60 45 Q 70 43 80 45 Q 90 42 100 45 Q 110 43 120 45 L 120 45 L 0 45 Z" fill="#4ADE80" fillOpacity="0.15" />
                                    <path d="M 6 45 Q 4 38 1 35 Q 5 40 7 45 M 22 45 Q 24 37 28 34 Q 26 40 24 45 M 50 45 Q 48 37 44 34 Q 48 40 51 45 M 78 45 Q 81 36 86 32 Q 82 39 80 45 M 110 45 Q 112 38 116 35 Q 113 41 111 45" stroke="#4ADE80" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                                    <path d="M 14 45 Q 11 35 6 31 Q 12 37 15 45 M 62 45 Q 65 34 71 29 Q 67 37 64 45 M 90 45 Q 87 36 82 32 Q 88 38 91 45" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                                    <path d="M 100 45 Q 99 36 98 26" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
                                    <path d="M 99 37 Q 92 35 94 32 Q 97 34 99 37" fill="#10B981" />
                                    <path d="M 99.5 33 Q 105 32 104 29 Q 101 30 99.5 33" fill="#10B981" />
                                    <circle cx="98" cy="20.5" r="4.5" fill="#EF4444" />
                                    <circle cx="98" cy="31.5" r="4.5" fill="#EF4444" />
                                    <circle cx="92.5" cy="26" r="4.5" fill="#EF4444" />
                                    <circle cx="103.5" cy="26" r="4.5" fill="#EF4444" />
                                    <circle cx="94.5" cy="22" r="4" fill="#EF4444" />
                                    <circle cx="101.5" cy="22" r="4" fill="#EF4444" />
                                    <circle cx="94.5" cy="30" r="4" fill="#EF4444" />
                                    <circle cx="101.5" cy="30" r="4" fill="#EF4444" />
                                    <circle cx="98" cy="26" r="3.5" fill="#FDC938" />
                                    <path d="M 5 28 Q 15 26 20 20 C 23 16 24 23 27 20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-slate-300 dark:text-slate-700/60" />
                                    <g>
                                        <ellipse cx="35" cy="20" rx="7.5" ry="5" transform="rotate(-5 35 20)" fill="#FDC938" />
                                        <path d="M 33.5 15.5 L 32 23.5 M 36.5 16 L 35 24" stroke="#022054" strokeWidth="1.5" strokeLinecap="round" />
                                        <ellipse cx="36" cy="13" rx="4" ry="2.5" transform="rotate(-40 36 13)" fill="#4991ff" fillOpacity="0.4" stroke="#4991ff" strokeWidth="0.75" />
                                        <ellipse cx="32" cy="13.5" rx="3.2" ry="2" transform="rotate(-50 32 13.5)" fill="#4991ff" fillOpacity="0.3" stroke="#4991ff" strokeWidth="0.75" />
                                        <circle cx="39.5" cy="19" r="0.8" fill="#022054" />
                                        <path d="M 28 21.5 L 26 22" stroke="#022054" strokeWidth="1.2" strokeLinecap="round" />
                                    </g>
                                </svg>
                            </div>

                            <button
                                onClick={() => setSelectedPostId(null)}
                                className="relative z-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                                style={{ width: '36px', height: '36px' }}
                            >
                                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '20px' }}>arrow_back</span>
                            </button>
                            <div className="relative z-10 flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{selectedPost.title}</p>
                                <p className="text-[10px] text-slate-400">Posted by {selectedPost.authorName}</p>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                            {/* Post Detail Card */}
                            <div className="bg-white dark:bg-[#121324] border border-slate-100 dark:border-slate-800/40 p-4 rounded-2xl shadow-sm animate-fadeIn">
                                {/* Author Info */}
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                                        {selectedPost.authorPhoto && selectedPost.authorPhoto !== 'null' && selectedPost.authorPhoto !== 'undefined' ? (
                                            <img src={selectedPost.authorPhoto} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                        ) : (
                                            <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                                                {selectedPost.authorName?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{selectedPost.authorName}</p>
                                        <p className="text-[10px] text-slate-400">{timeAgo(selectedPost.createdAt)}</p>
                                    </div>
                                </div>

                                {/* Content text */}
                                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3">{selectedPost.title}</h2>
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{selectedPost.description}</p>

                                {/* Attached Images */}
                                {selectedPost.imageURLs && selectedPost.imageURLs.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-2">
                                        {selectedPost.imageURLs.map((url, i) => (
                                            <div key={i} className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                                <img src={url} alt="" className="w-full h-auto max-h-96 object-contain" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Footer count indicators */}
                                <div className="flex items-center gap-3 mt-4 pt-3.5 border-t border-slate-50 dark:border-slate-800/40">
                                    <button 
                                        onClick={() => {
                                            if (currentUser) {
                                                upvoteGlobalPost(selectedPost.id, currentUser.uid);
                                            } else {
                                                navigate('/signin');
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                            selectedPost.upvotes?.includes(currentUser?.uid) 
                                                ? 'bg-primary/10 text-primary' 
                                                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: selectedPost.upvotes?.includes(currentUser?.uid) ? "'FILL' 1" : "'FILL' 0" }}>arrow_upward</span>
                                        <span>Upvote {selectedPost.upvotes?.length || 0}</span>
                                    </button>
                                    
                                    <div className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chat_bubble</span>
                                        <span>{comments.length} comments</span>
                                    </div>
                                </div>
                            </div>

                            {/* Comments Thread */}
                            <div className="flex flex-col gap-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comments</p>
                                {comments.length === 0 ? (
                                    <div className="py-8 text-center flex flex-col items-center justify-center opacity-50 bg-white dark:bg-[#121324] border border-slate-100 dark:border-slate-800/40 p-4 rounded-2xl shadow-sm">
                                        <span className="material-symbols-outlined text-3xl mb-1 text-slate-400">forum</span>
                                        <p className="text-xs font-medium text-slate-500">No comments yet. Start the conversation!</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {(() => {
                                            const topLevelComments = comments.filter(c => !c.parentId);
                                            const repliesByParentId = comments.reduce((acc, c) => {
                                                if (c.parentId) {
                                                    if (!acc[c.parentId]) acc[c.parentId] = [];
                                                    acc[c.parentId].push(c);
                                                }
                                                return acc;
                                            }, {});

                                            return topLevelComments.map(comment => {
                                                const commentReplies = repliesByParentId[comment.id] || [];
                                                const isOp = comment.authorId === selectedPost.authorId;
                                                return (
                                                    <div key={comment.id} className="flex flex-col bg-white dark:bg-[#121324] p-3 rounded-2xl border border-slate-50 dark:border-slate-800/40 animate-fadeIn gap-1">
                                                        <div className="flex gap-3 items-start">
                                                            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                                                                {comment.authorPhoto && comment.authorPhoto !== 'null' && comment.authorPhoto !== 'undefined' ? (
                                                                    <img src={comment.authorPhoto} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                                                ) : (
                                                                    <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold text-[10px]">
                                                                        {comment.authorName?.[0]?.toUpperCase() || '?'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{comment.authorName}</span>
                                                                    {isOp && (
                                                                        <span className="text-[8px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full select-none">OP</span>
                                                                    )}
                                                                    <span className="text-[9px] text-slate-400">{timeAgo(comment.createdAt)}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                                                
                                                                {currentUser && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            setReplyingToCommentId(comment.id);
                                                                            setReplyInput('');
                                                                        }}
                                                                        className="text-[10px] text-primary font-semibold mt-2 hover:underline flex items-center gap-1 select-none"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>reply</span>
                                                                        Reply
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Inline Reply Input */}
                                                        {replyingToCommentId === comment.id && (
                                                            <div className="mt-2.5 ml-10 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-full px-3 py-1.5">
                                                                <input 
                                                                    type="text"
                                                                    placeholder={`Reply to ${comment.authorName}...`}
                                                                    value={replyInput}
                                                                    onChange={e => setReplyInput(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            handleSendReply(comment.id);
                                                                        }
                                                                    }}
                                                                    className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 dark:text-slate-100"
                                                                    style={{ border: 'none', outline: 'none' }}
                                                                    autoFocus
                                                                />
                                                                <button 
                                                                    onClick={() => handleSendReply(comment.id)}
                                                                    disabled={!replyInput.trim()}
                                                                    className="text-[10px] font-bold text-primary disabled:opacity-50"
                                                                >
                                                                    Send
                                                                </button>
                                                                <button 
                                                                    onClick={() => setReplyingToCommentId(null)}
                                                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Replies list */}
                                                        {commentReplies.length > 0 && (
                                                            <div className="mt-3 ml-10 pl-3.5 border-l-2 border-slate-100 dark:border-slate-800/60 flex flex-col gap-3">
                                                                {commentReplies.map(reply => {
                                                                    const isReplyOp = reply.authorId === selectedPost.authorId;
                                                                    return (
                                                                        <div key={reply.id} className="flex gap-2.5 items-start">
                                                                            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                                                                                {reply.authorPhoto && reply.authorPhoto !== 'null' && reply.authorPhoto !== 'undefined' ? (
                                                                                    <img src={reply.authorPhoto} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                                                                ) : (
                                                                                    <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold text-[8px]">
                                                                                        {reply.authorName?.[0]?.toUpperCase() || '?'}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">{reply.authorName}</span>
                                                                                    {isReplyOp && (
                                                                                        <span className="text-[8px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full select-none">OP</span>
                                                                                    )}
                                                                                    <span className="text-[8px] text-slate-400">{timeAgo(reply.createdAt)}</span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">{reply.text}</p>
                                                                                
                                                                                {currentUser && (
                                                                                    <button 
                                                                                        onClick={() => {
                                                                                            setReplyingToCommentId(comment.id);
                                                                                            setReplyInput(`@${reply.authorName} `);
                                                                                        }}
                                                                                        className="text-[9px] text-slate-400 font-semibold mt-1 hover:text-primary transition-colors flex items-center gap-0.5 select-none"
                                                                                    >
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>reply</span>
                                                                                        Reply
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add Comment Input Bar */}
                        {currentUser ? (
                            <div 
                                className="px-4 py-2.5 bg-white dark:bg-[#121324] border-t border-slate-100 dark:border-slate-800/40 flex items-center gap-3 flex-shrink-0"
                                style={{ paddingBottom: 'calc(0.5rem + var(--safe-area-bottom))' }}
                            >
                                <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-full px-4 py-2">
                                    <input 
                                        type="text"
                                        placeholder="Add a comment..."
                                        value={commentInput}
                                        onChange={e => setCommentInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                handleAddComment();
                                            }
                                        }}
                                        className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 dark:text-slate-100"
                                        style={{ border: 'none', outline: 'none' }}
                                    />
                                    {commentInput.trim() && (
                                        <button 
                                            onClick={handleAddComment}
                                            className="flex items-center justify-center rounded-full bg-primary text-white w-7 h-7 hover:bg-primary/95 transition-all select-none"
                                        >
                                            <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>send</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div 
                                className="p-4 bg-white dark:bg-[#121324] border-t border-slate-100 dark:border-slate-800/40 text-center"
                                style={{ paddingBottom: 'calc(1rem + var(--safe-area-bottom))' }}
                            >
                                <p className="text-xs text-slate-500">Sign in to add a comment</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Forum Feed View */
                    <div className="flex flex-col h-full min-h-0 bg-[#eceef2] dark:bg-[#090a15]">
                        {/* Header */}
                        <div 
                            className="relative overflow-hidden flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-[#121324]/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/40 flex-shrink-0"
                            style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
                        >
                            {/* Honeycomb grid overlay */}
                            <div className="absolute right-0 top-0 bottom-0 overflow-hidden pointer-events-none opacity-25 dark:opacity-30">
                                <svg width="140" height="100%" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
                                    <path d="M100 10 L115 18.5 L115 35.5 L100 44 L85 35.5 L85 18.5 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/30 dark:text-amber-400/25" />
                                    <path d="M85 35.5 L100 44 L100 61 L85 69.5 L70 61 L70 44 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/35 dark:text-amber-400/30" />
                                    <path d="M70 10 L85 18.5 L85 35.5 L70 44 L55 35.5 L55 18.5 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/20 dark:text-amber-400/15" />
                                    <path d="M115 35.5 L130 44 L130 61 L115 69.5 L100 61 L100 44 Z" stroke="currentColor" strokeWidth="1" className="text-amber-500/20 dark:text-amber-400/15" />
                                </svg>
                            </div>

                            {/* SVG Graphic Scene (Bee, Flower, Grass) */}
                            <div className="absolute right-3 bottom-0 overflow-hidden pointer-events-none select-none w-[120px] h-[45px]">
                                <svg width="120" height="45" viewBox="0 0 120 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M 0 45 Q 10 42 20 45 Q 30 43 40 45 Q 50 42 60 45 Q 70 43 80 45 Q 90 42 100 45 Q 110 43 120 45 L 120 45 L 0 45 Z" fill="#4ADE80" fillOpacity="0.15" />
                                    <path d="M 6 45 Q 4 38 1 35 Q 5 40 7 45 M 22 45 Q 24 37 28 34 Q 26 40 24 45 M 50 45 Q 48 37 44 34 Q 48 40 51 45 M 78 45 Q 81 36 86 32 Q 82 39 80 45 M 110 45 Q 112 38 116 35 Q 113 41 111 45" stroke="#4ADE80" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                                    <path d="M 14 45 Q 11 35 6 31 Q 12 37 15 45 M 62 45 Q 65 34 71 29 Q 67 37 64 45 M 90 45 Q 87 36 82 32 Q 88 38 91 45" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                                    <path d="M 100 45 Q 99 36 98 26" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
                                    <path d="M 99 37 Q 92 35 94 32 Q 97 34 99 37" fill="#10B981" />
                                    <path d="M 99.5 33 Q 105 32 104 29 Q 101 30 99.5 33" fill="#10B981" />
                                    <circle cx="98" cy="20.5" r="4.5" fill="#EF4444" />
                                    <circle cx="98" cy="31.5" r="4.5" fill="#EF4444" />
                                    <circle cx="92.5" cy="26" r="4.5" fill="#EF4444" />
                                    <circle cx="103.5" cy="26" r="4.5" fill="#EF4444" />
                                    <circle cx="94.5" cy="22" r="4" fill="#EF4444" />
                                    <circle cx="101.5" cy="22" r="4" fill="#EF4444" />
                                    <circle cx="94.5" cy="30" r="4" fill="#EF4444" />
                                    <circle cx="101.5" cy="30" r="4" fill="#EF4444" />
                                    <circle cx="98" cy="26" r="3.5" fill="#FDC938" />
                                    <path d="M 5 28 Q 15 26 20 20 C 23 16 24 23 27 20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-slate-300 dark:text-slate-700/60" />
                                    <g>
                                        <ellipse cx="35" cy="20" rx="7.5" ry="5" transform="rotate(-5 35 20)" fill="#FDC938" />
                                        <path d="M 33.5 15.5 L 32 23.5 M 36.5 16 L 35 24" stroke="#022054" strokeWidth="1.5" strokeLinecap="round" />
                                        <ellipse cx="36" cy="13" rx="4" ry="2.5" transform="rotate(-40 36 13)" fill="#4991ff" fillOpacity="0.4" stroke="#4991ff" strokeWidth="0.75" />
                                        <ellipse cx="32" cy="13.5" rx="3.2" ry="2" transform="rotate(-50 32 13.5)" fill="#4991ff" fillOpacity="0.3" stroke="#4991ff" strokeWidth="0.75" />
                                        <circle cx="39.5" cy="19" r="0.8" fill="#022054" />
                                        <path d="M 28 21.5 L 26 22" stroke="#022054" strokeWidth="1.2" strokeLinecap="round" />
                                    </g>
                                </svg>
                            </div>

                            <button
                                onClick={() => navigate('/chats')}
                                className="relative z-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                                style={{ width: '36px', height: '36px' }}
                            >
                                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '20px' }}>arrow_back</span>
                            </button>
                            <div className="relative z-10">
                                <h1 className="font-bold text-sm text-slate-900 dark:text-slate-100">Global Forum</h1>
                                <p className="text-[10px] text-slate-400">Advice, questions & experiences</p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/40 bg-white dark:bg-[#121324] flex-shrink-0">
                            <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-full px-3 py-1.5">
                                <span className="material-symbols-outlined text-slate-400 mr-2" style={{ fontSize: '18px' }}>search</span>
                                <input 
                                    type="text"
                                    placeholder="Search posts..."
                                    value={forumSearchQuery}
                                    onChange={e => setForumSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 dark:text-slate-100"
                                    style={{ border: 'none', outline: 'none' }}
                                />
                                {forumSearchQuery && (
                                    <button onClick={() => setForumSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Post Cards List */}
                        <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-3">
                            {filteredPosts.length === 0 ? (
                                <div className="py-12 text-center flex flex-col items-center justify-center opacity-60 bg-white dark:bg-[#121324] border border-slate-100 dark:border-slate-800/40 p-4 rounded-2xl shadow-sm">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">forum</span>
                                    <p className="font-semibold text-sm text-[#0d1b12] dark:text-white mb-1">No posts found</p>
                                    <p className="text-xs text-slate-500 max-w-[240px]">
                                        {forumSearchQuery.trim() ? 'Try another search query.' : 'Be the first to post something in this forum!'}
                                    </p>
                                </div>
                            ) : (
                                filteredPosts.map(post => {
                                    const hasLiked = post.upvotes?.includes(currentUser?.uid);
                                    return (
                                        <div
                                            key={post.id}
                                            onClick={() => setSelectedPostId(post.id)}
                                            className="bg-white dark:bg-[#121324] border border-slate-100 dark:border-slate-800/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer animate-fadeIn"
                                        >
                                            {/* Author */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                                                    {post.authorPhoto && post.authorPhoto !== 'null' && post.authorPhoto !== 'undefined' ? (
                                                        <img src={post.authorPhoto} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                                    ) : (
                                                        <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold text-[10px]">
                                                            {post.authorName?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{post.authorName}</p>
                                                    <p className="text-[9px] text-slate-400">{timeAgo(post.createdAt)}</p>
                                                </div>
                                            </div>

                                            {/* Title & Truncated description */}
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2.5 mb-1.5 line-clamp-2">{post.title}</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">{post.description}</p>

                                            {/* Attached Images Thumbnail */}
                                            {post.imageURLs && post.imageURLs.length > 0 && (
                                                <div className="mt-2.5 rounded-xl overflow-hidden max-h-56 border border-slate-100 dark:border-slate-800/60 aspect-video bg-slate-50 dark:bg-slate-900">
                                                    <img src={post.imageURLs[0]} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}

                                            {/* Footer details */}
                                            <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-slate-50 dark:border-slate-800/20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (currentUser) {
                                                            upvoteGlobalPost(post.id, currentUser.uid);
                                                        } else {
                                                            navigate('/signin');
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                                        hasLiked 
                                                            ? 'bg-primary/10 text-primary' 
                                                            : 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: hasLiked ? "'FILL' 1" : "'FILL' 0" }}>arrow_upward</span>
                                                    <span>Upvote {post.upvotes?.length || 0}</span>
                                                </button>

                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chat_bubble</span>
                                                    <span>{post.commentCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Floating Action Button */}
                        {currentUser && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center justify-center gap-1 bg-[#4991ff] hover:bg-[#357ae8] text-white font-bold text-sm px-6 py-3 rounded-full shadow-lg shadow-[#4991ff]/40 active:scale-95 transition-all select-none whitespace-nowrap"
                            >
                                <span className="material-symbols-outlined font-bold" style={{ fontSize: '18px' }}>add</span>
                                <span>Post</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Create Post Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                        <div className="w-full max-w-md bg-white dark:bg-[#121324] rounded-t-3xl border-t border-slate-200/40 dark:border-slate-800/80 shadow-2xl flex flex-col max-h-[90vh] animate-slideUp">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 flex-shrink-0">
                                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">Create a Post</h2>
                                <button 
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setPostTitle('');
                                        setPostDescription('');
                                        postPreviews.forEach(p => URL.revokeObjectURL(p.url));
                                        setPostPreviews([]);
                                        setPostFiles([]);
                                    }}
                                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                                </button>
                            </div>
                            
                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Post Title</label>
                                    <input 
                                        type="text"
                                        placeholder="An interesting title..."
                                        value={postTitle}
                                        onChange={e => setPostTitle(e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-primary outline-none"
                                        style={{ outline: 'none' }}
                                    />
                                </div>
                                
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                                    <textarea 
                                        rows={4}
                                        placeholder="What do you want to ask or share?"
                                        value={postDescription}
                                        onChange={e => setPostDescription(e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-primary outline-none resize-none"
                                        style={{ outline: 'none' }}
                                    />
                                </div>
                                
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Images (Optional)</label>
                                    
                                    {postPreviews.length > 0 && (
                                        <div className="flex gap-2 py-1 overflow-x-auto">
                                            {postPreviews.map((p, index) => (
                                                <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                                                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePostFile(index)}
                                                        className="absolute top-1 right-1 w-4 h-4 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white"
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <label className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined text-xl mb-1">image</span>
                                        <span className="text-[10px] font-medium">Add Images</span>
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handlePostFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                            
                            {/* Modal Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 flex-shrink-0">
                                <button
                                    onClick={handleCreatePost}
                                    disabled={isPosting || !postTitle.trim() || !postDescription.trim()}
                                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    {isPosting ? (
                                        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>publish</span>
                                            <span>Publish Post</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60 flex-shrink-0"
                style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
            >
                <button
                    onClick={() => navigate('/chats')}
                    className="flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                    style={{ width: '36px', height: '36px' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-main)' }}>arrow_back</span>
                </button>

                {/* Avatar/Icon */}
                <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: '36px', height: '36px', background: isGlobal ? 'rgba(2,32,84,0.9)' : 'rgba(73,145,255,0.12)' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: isGlobal ? '#FDC938' : '#4991ff' }}>
                        {isGlobal 
                            ? 'public' 
                            : (CATEGORIES.find(c => c.id === issue?.category)?.icon || 'chat_bubble')
                        }
                    </span>
                </div>

                <div 
                    onClick={() => {
                        if (!isGlobal) {
                            setIsParticipantsModalOpen(true);
                        }
                    }}
                    className={`flex-1 min-w-0 ${!isGlobal ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                >
                    <p className="font-semibold line-clamp-1" style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{title}</p>
                    {isGlobal ? (
                        <p className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>Everyone can chat here</p>
                    ) : (
                        <p className="text-xs line-clamp-1 font-semibold flex items-center" style={{ color: '#22c55e' }}>
                            <span style={{ marginRight: '4px' }}>•</span>
                            <span>Online: {issue?.chatParticipants?.length === 34 ? 2 : Math.max(1, Math.min(issue?.chatParticipants?.length || 1, Math.ceil((issue?.chatParticipants?.length || 1) * 0.08) || 1))}/{issue?.chatParticipants?.length || 1}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Chat Area Wrapper */}
            <div className="flex-1 relative flex flex-col min-h-0">
                {/* Voting Widget / Resolution Poll */}
                {!isGlobal && issue && !issue.chatClosed && (
                    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                        {issue.resolutionPollActive ? (
                            <ResolutionConfirmationWidget
                                issue={issue}
                                currentUser={currentUser}
                                onConfirm={voteToConfirmResolution}
                            />
                        ) : (
                            <ChatVotingWidget 
                                issue={issue} 
                                currentUser={currentUser} 
                                onVote={voteOnIssueStatus} 
                                onRefreshVote={voteToRefreshIssue}
                            />
                        )}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-16">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-secondary)' }}>chat_bubble_outline</span>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No messages yet. Start the conversation!</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => {
                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                        const timeDivider = getTimeDivider(msg, prevMsg);
                        const isLastMessage = idx === messages.length - 1;
                        return (
                            <div key={msg.id || idx}>
                                {timeDivider && (
                                    <div className="flex justify-center my-5 select-none animate-fadeIn">
                                        <span 
                                            className="text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-500 uppercase"
                                            style={{ fontFamily: 'var(--font-outfit)' }}
                                        >
                                            {timeDivider}
                                        </span>
                                    </div>
                                )}
                                <MessageBubble
                                    msg={msg}
                                    isOwn={msg.senderId === currentUser?.uid}
                                    isLast={isLastMessage}
                                />
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input bar */}
            {currentUser ? (
                issue?.chatClosed ? (
                    <div
                        className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/80 flex-shrink-0"
                        style={{ paddingBottom: 'calc(1.25rem + var(--safe-area-bottom))' }}
                    >
                        <p className="text-sm font-semibold flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '18px' }}>lock</span>
                            <span>This chat group is closed because the issue has been resolved.</span>
                        </p>
                    </div>
                ) : (
                    <div
                        className="flex flex-col bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800/60 flex-shrink-0"
                        style={{ paddingBottom: 'calc(0.375rem + var(--safe-area-bottom))' }}
                    >
                    {/* Media Preview Bar (Only shown if files selected) */}
                    {previewUrls.length > 0 && (
                        <div className="flex gap-2.5 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/30">
                            {previewUrls.map((preview, index) => (
                                <div key={index} className="relative flex-shrink-0 w-14 h-14 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    {preview.type === 'video' ? (
                                        <div className="flex flex-col items-center justify-center text-slate-500 gap-0.5">
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>play_circle</span>
                                            <span className="text-[7px] font-bold truncate max-w-[50px] px-0.5">{preview.name || 'Video'}</span>
                                        </div>
                                    ) : (
                                        <img src={preview.url} alt="" className="w-full h-full object-cover" />
                                    )}
                                    
                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(index)}
                                        className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white"
                                        style={{ width: '16px', height: '16px' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Chat Text Input Row */}
                    <div className="flex items-center px-4 py-2">
                        {/* Pill container */}
                        <div 
                            className="flex-1 flex items-center rounded-full px-4 py-2.5 transition-all"
                            style={{ 
                                background: 'var(--input-bg)', 
                                border: `1.5px solid ${isFocused ? '#4991ff' : 'var(--border)'}` 
                            }}
                        >
                            {/* Left Icon (Emoji/Smiley face) */}
                            <span 
                                className="material-symbols-outlined text-slate-400 dark:text-slate-500 mr-3 cursor-pointer hover:text-slate-600 select-none" 
                                style={{ fontSize: '22px' }}
                            >
                                sentiment_satisfied
                            </span>

                            {/* Text input */}
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Message..."
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                disabled={isUploadingMedia}
                                className="flex-1 bg-transparent border-0 outline-none text-sm py-1.5"
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    color: 'var(--text-main)',
                                    fontFamily: 'var(--font-display)',
                                }}
                            />

                            {/* Right action button (Gallery turns to Send when text/media is present) */}
                            {inputText.trim() || selectedFiles.length > 0 ? (
                                <button
                                    onClick={handleSend}
                                    disabled={isUploadingMedia}
                                    className="flex items-center justify-center rounded-full bg-[#4991ff] hover:bg-[#357ae8] active:scale-95 transition-all flex-shrink-0"
                                    style={{ width: '28px', height: '28px' }}
                                >
                                    {isUploadingMedia ? (
                                        <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                    ) : (
                                        <span className="material-symbols-outlined text-white" style={{ fontSize: '15px' }}>send</span>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <label
                                        htmlFor="chat-media-input"
                                        className="flex items-center justify-center cursor-pointer text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 flex-shrink-0 transition-colors"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>image</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="chat-media-input"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
                )
            ) : (
                <div
                    className="flex flex-col items-center gap-3 px-4 py-4 bg-white/95 dark:bg-surface-dark/95 border-t border-slate-100 dark:border-slate-800/60 flex-shrink-0"
                    style={{ paddingBottom: 'calc(1rem + var(--safe-area-bottom))' }}
                >
                    <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Sign in to join the conversation</p>
                    <button
                        className="btn-primary"
                        style={{ padding: '0.75rem 2rem', fontSize: '0.9rem' }}
                        onClick={() => navigate('/signin')}
                    >
                        Sign In
                    </button>
                </div>
            )}

            {/* Participants Modal */}
            <ParticipantsModal
                isOpen={isParticipantsModalOpen}
                onClose={() => setIsParticipantsModalOpen(false)}
                participants={participantsList}
                loading={loadingParticipants}
            />
        </div>
    );
};

export default ChatPage;
