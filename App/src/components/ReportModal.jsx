import { useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ReportModal = ({ isOpen, onClose, targetId, targetType, targetName, reporterId, onSuccess, onError }) => {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const reportReasons = [
        'Prohibited items',
        'Misleading information',
        'Scam/Fraud',
        'Offensive content',
        'Fake user/Bot',
        'Other'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return;

        setIsSubmitting(true);
        try {
            const reportData = {
                targetId,
                targetType, // 'issue', 'user', 'chat' etc.
                targetName,
                reason,
                description,
                reporterId: reporterId || 'anonymous',
                status: 'pending',
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'reports'), reportData);
            setIsSuccess(true);

            if (onSuccess) {
                onSuccess();
            }

            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setReason('');
                setDescription('');
            }, 2000);
        } catch (error) {
            console.error('Error submitting report:', error);
            onError?.('Failed to submit report. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-slideUp" onClick={e => e.stopPropagation()}>
                {isSuccess ? (
                    <div className="flex flex-col items-center text-center py-4">
                        <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 animate-pulse">check_circle</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-outfit">Report Submitted</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Thank you for helping us keep the community safe.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Report Issue</h2>
                            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={onClose}>
                                <span className="material-symbols-outlined text-xl text-slate-500 dark:text-slate-400">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Reporting: <strong className="text-slate-800 dark:text-slate-200">{targetName}</strong>
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Reason for report</label>
                                <div className="flex flex-wrap gap-2">
                                    {reportReasons.map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                                reason === r
                                                    ? 'bg-primary text-white shadow-md'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                                            }`}
                                            onClick={() => setReason(r)}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Additional details (optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell us more about the details..."
                                    rows="4"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!reason || isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>,
        document.getElementById('root')
    );
};

export default ReportModal;
