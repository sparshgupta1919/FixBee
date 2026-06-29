import { useState, useEffect, useCallback, useRef } from 'react';
import './Toast.css';

const ICON_MAP = {
    success: { icon: 'check_circle', className: 'toast-success' },
    error: { icon: 'error', className: 'toast-error' },
    warning: { icon: 'warning', className: 'toast-warning' },
    info: { icon: 'info', className: 'toast-info' },
};

const Toast = ({ message, type = 'info', isVisible, onClose, duration = 3000 }) => {
    const [isExiting, setIsExiting] = useState(false);
    const timerRef = useRef(null);

    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => {
            setIsExiting(false);
            onClose?.();
        }, 280);
    }, [onClose]);

    useEffect(() => {
        if (isVisible && duration > 0) {
            timerRef.current = setTimeout(handleClose, duration);
            return () => clearTimeout(timerRef.current);
        }
    }, [isVisible, duration, handleClose]);

    if (!isVisible && !isExiting) return null;

    const { icon, className } = ICON_MAP[type] || ICON_MAP.info;

    return (
        <div className={`toast-container ${className} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
            <div className="toast-content">
                <span className="material-symbols-outlined toast-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                </span>
                <p className="toast-message">{message}</p>
                <button className="toast-dismiss" onClick={handleClose}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
    );
};

export default Toast;
