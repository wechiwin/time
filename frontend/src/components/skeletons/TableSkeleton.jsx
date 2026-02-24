// src/components/skeletons/TableSkeleton.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import Skeleton from '../ui/Skeleton';

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A skeleton component for table loading states.
 * Mimics the structure of data tables with configurable rows and columns.
 *
 * @param {object} props
 * @param {number} [props.rows=5] - Number of skeleton rows
 * @param {number} [props.columns=6] - Number of skeleton columns
 * @param {boolean} [props.showHeader=true] - Whether to show table header skeleton
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.compact=false] - Use compact mode for smaller tables
 */
const TableSkeleton = ({
    rows = 5,
    columns = 6,
    showHeader = true,
    className = '',
    compact = false,
}) => {
    const { t } = useTranslation();

    const cellHeight = compact ? 'h-6' : 'h-8';
    const headerHeight = compact ? 'h-8' : 'h-10';
    const rowPadding = compact ? 'py-2' : 'py-4';

    return (
        <div className={cn('table-container', className)}>
            <table className="min-w-full">
                {showHeader && (
                    <thead>
                        <tr>
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="table-header">
                                    <Skeleton
                                        variant="text"
                                        className={cn('w-20 mx-auto', headerHeight)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={rowIndex} className={rowPadding}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={colIndex} className="table-cell">
                                    <Skeleton
                                        variant="text"
                                        className={cn(
                                            cellHeight,
                                            // Last column typically has actions (shorter width)
                                            colIndex === columns - 1 ? 'w-16 mx-auto' :
                                            // First column typically has code (medium width)
                                            colIndex === 0 ? 'w-24' :
                                            // Name column (wider)
                                            colIndex === 1 ? 'w-32' :
                                            // Other columns
                                            'w-20'
                                        )}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

/**
 * A simplified mobile-friendly table skeleton
 */
export const TableSkeletonMobile = ({ rows = 3, className = '' }) => {
    return (
        <div className={cn('space-y-3 p-4', className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex justify-between items-start mb-3">
                        <Skeleton variant="text" className="h-5 w-24" />
                        <Skeleton variant="text" className="h-5 w-16" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton variant="text" className="h-4 w-full" />
                        <Skeleton variant="text" className="h-4 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TableSkeleton;
