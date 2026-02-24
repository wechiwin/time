// src/components/skeletons/CardSkeleton.jsx
import React from 'react';
import Skeleton from '../ui/Skeleton';

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A skeleton component for card and chart loading states.
 * Extracted from Dashboard's KpiCardSkeleton and ChartSkeleton.
 *
 * @param {object} props
 * @param {string} [props.variant='kpi'] - Variant: 'kpi' for KPI cards, 'chart' for chart containers
 * @param {string} [props.className] - Additional CSS classes
 */
const CardSkeleton = ({ variant = 'kpi', className = '' }) => {
    if (variant === 'chart') {
        return <ChartSkeleton className={className} />;
    }

    return <KpiCardSkeleton className={className} />;
};

/**
 * KPI Card Skeleton - matches the KpiCard component structure
 */
const KpiCardSkeleton = ({ className = '' }) => (
    <div
        className={cn(
            'bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5',
            'border border-gray-100 dark:border-gray-700',
            className
        )}
    >
        <div className="flex justify-between items-start">
            <div className="flex-1">
                <Skeleton variant="text" className="h-4 w-20 mb-2" />
                <Skeleton variant="text" className="h-8 w-24" />
            </div>
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                <div className="w-5 h-5" />
            </div>
        </div>
        <Skeleton variant="text" className="h-4 w-16 mt-3" />
    </div>
);

/**
 * Chart Skeleton - matches the chart container structure
 */
const ChartSkeleton = ({ className = '' }) => (
    <div
        className={cn(
            'bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5',
            'border border-gray-100 dark:border-gray-700',
            className
        )}
    >
        <Skeleton variant="text" className="h-6 w-32 mb-4" />
        <Skeleton variant="rectangular" className="h-60 md:h-80 w-full" />
    </div>
);

/**
 * Multiple KPI Cards Skeleton
 * @param {number} [props.count=4] - Number of KPI cards to display
 */
export const KpiCardsSkeleton = ({ count = 4, className = '' }) => (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
            <KpiCardSkeleton key={i} />
        ))}
    </div>
);

/**
 * Dashboard Layout Skeleton - Full dashboard loading state
 */
export const DashboardSkeleton = ({ className = '' }) => (
    <div className={cn('p-2 md:p-4 max-w-7xl mx-auto space-y-3', className)}>
        {/* KPI Cards Row */}
        <KpiCardsSkeleton count={4} />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartSkeleton className="lg:col-span-2" />
            <ChartSkeleton />
        </div>
    </div>
);

export default CardSkeleton;
