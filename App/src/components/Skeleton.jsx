import React from 'react';

// Single issue card skeleton
export const CardSkeleton = () => (
    <div className="w-full bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-pulse">
        {/* Header section (reporter avatar + name) */}
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-2 w-16 rounded bg-slate-200/80 dark:bg-slate-800/80" />
            </div>
        </div>
        
        {/* Image skeleton */}
        <div className="w-full h-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
        
        {/* Title & Metadata */}
        <div className="flex flex-col gap-2 mt-1">
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-1/2 rounded bg-slate-200/80 dark:bg-slate-800/80" />
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
    </div>
);

// Homepage skeleton
export const HomeSkeleton = () => (
    <div className="flex flex-col gap-4 p-4">
        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    </div>
);

// Details page skeleton
export const DetailsSkeleton = () => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark animate-pulse">
        {/* Image Banner */}
        <div className="w-full h-64 bg-slate-200 dark:bg-slate-800" />
        
        {/* Content Box */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">
            {/* Title & Category */}
            <div className="flex flex-col gap-2">
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" style={{ border: '1px solid var(--border)' }} />
                <div className="h-6 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

            {/* Description */}
            <div className="flex flex-col gap-2">
                <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Location placeholder */}
            <div className="flex items-center gap-2 mt-2">
                <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            
            {/* Map Area */}
            <div className="w-full h-40 rounded-xl bg-slate-200 dark:bg-slate-800 mt-2" />
        </div>
    </div>
);

// Profile page skeleton
export const ProfileSkeleton = () => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark animate-pulse">
        {/* Header/Hero Profile */}
        <div className="flex flex-col items-center gap-3 py-6 px-4" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-44 rounded bg-slate-200/80 dark:bg-slate-800/80" />
            
            {/* Stats list */}
            <div className="flex gap-6 mt-3">
                <div className="flex flex-col items-center gap-1">
                    <div className="h-4 w-6 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <div className="h-4 w-6 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                </div>
            </div>
        </div>

        {/* User's Reports Title */}
        <div className="px-4 pt-5 pb-2">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Content list */}
        <div className="flex flex-col gap-4 p-4">
            <CardSkeleton />
            <CardSkeleton />
        </div>
    </div>
);
