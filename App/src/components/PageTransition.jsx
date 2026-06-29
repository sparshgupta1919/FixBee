import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const SWIPE_PAGES = ['/home', '/chats', '/profile'];

const PAGE_DEPTH = {
    '/': 0,
    '/signin': 0,
    '/signup': 0,
    '/onboarding': 0,
    '/home': 1,
    '/chats': 1,
    '/profile': 1,
    '/report': 2,
    '/notifications': 2,
    '/admin': 2,
    '/privacy': 2,
    '/terms': 2,
};

function getDepth(pathname) {
    if (PAGE_DEPTH[pathname] !== undefined) return PAGE_DEPTH[pathname];
    if (pathname.startsWith('/issue/') || pathname.startsWith('/chat/')) return 2;
    return 1;
}

const PageTransition = ({ children }) => {
    const location = useLocation();
    const [displayedChildren, setDisplayedChildren] = useState(children);
    const [transitionClass, setTransitionClass] = useState('');
    const prevPathRef = useRef(location.pathname);
    const isFirstRender = useRef(true);
    const timeoutRef = useRef(null);

    const getTransitionDirection = useCallback((from, to) => {
        if (SWIPE_PAGES.includes(from) && SWIPE_PAGES.includes(to)) return 'none';
        const fromDepth = getDepth(from);
        const toDepth = getDepth(to);
        if (toDepth > fromDepth) return 'forward';
        if (toDepth < fromDepth) return 'back';
        return 'fade';
    }, []);

    useEffect(() => {
        const prevPath = prevPathRef.current;
        const newPath = location.pathname;

        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevPathRef.current = newPath;
            setDisplayedChildren(children);
            return;
        }

        if (prevPath === newPath) {
            setDisplayedChildren(children);
            return;
        }

        const direction = getTransitionDirection(prevPath, newPath);
        prevPathRef.current = newPath;

        if (direction === 'none') {
            setTransitionClass('');
            setDisplayedChildren(children);
            return;
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const exitClass =
            direction === 'forward' ? 'page-exit-left' :
            direction === 'back' ? 'page-exit-right' :
            'page-exit-fade';

        setTransitionClass(exitClass);

        timeoutRef.current = setTimeout(() => {
            setDisplayedChildren(children);
            const enterClass =
                direction === 'forward' ? 'page-enter-right' :
                direction === 'back' ? 'page-enter-left' :
                'page-enter-fade';
            setTransitionClass(enterClass);
            timeoutRef.current = setTimeout(() => {
                setTransitionClass('');
            }, 220);
        }, 120);

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [location.pathname, children, getTransitionDirection]);

    return (
        <div className={`page-transition-wrapper ${transitionClass}`}>
            {displayedChildren}
        </div>
    );
};

export default PageTransition;
