// src/components/common/TableWrapper.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CenteredSpinner } from '../ui/Spinner';
import EmptyState from './EmptyState';

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A wrapper component that handles loading, empty, and error states for tables.
 * Provides a consistent UX across all data tables in the application.
 *
 * @param {object} props
 * @param {boolean} [props.isLoading=false] - Whether data is currently loading
 * @param {boolean} [props.isEmpty=false] - Whether there's no data to display
 * @param {React.ReactNode} [props.loadingComponent] - Custom loading component
 * @param {React.ReactNode} [props.emptyComponent] - Custom empty state component
 * @param {string} [props.emptyMessage] - Message to show when empty
 * @param {string} [props.emptyHint] - Hint text for empty state
 * @param {React.ReactNode} [props.emptyAction] - Action button for empty state
 * @param {string} [props.error] - Error message to display
 * @param {React.ReactNode} [props.children] - The table content to display
 * @param {string} [props.className] - Additional CSS classes
 */
export default function TableWrapper({
    isLoading = false,
    isEmpty = false,
    loadingComponent,
    emptyComponent,
    emptyMessage,
    emptyHint,
    emptyAction,
    error,
    children,
    className = '',
}) {
    const { t } = useTranslation();

    // Error state
    if (error) {
        return (
            <div className={cn('text-center py-12', className)}>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-700 dark:text-red-300">
                        {t('data_loading_failed')}: {error}
                    </p>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        if (loadingComponent) {
            return <div className={className}>{loadingComponent}</div>;
        }
        return <CenteredSpinner className={className} />;
    }

    // Empty state
    if (isEmpty) {
        if (emptyComponent) {
            return <div className={className}>{emptyComponent}</div>;
        }
        return (
            <EmptyState
                message={emptyMessage}
                hint={emptyHint}
                action={emptyAction}
                className={className}
            />
        );
    }

    // Normal state - render children
    return <div className={className}>{children}</div>;
}

/**
 * A simplified wrapper for tables with data array
 * Automatically determines isEmpty based on data length
 *
 * @param {object} props
 * @param {Array} [props.data] - The data array
 * @param {boolean} [props.isLoading] - Loading state
 * @param {React.ReactNode} [props.children] - Table content
 * @param {string} [props.emptyMessage] - Empty state message
 */
export function TableWithData({
    data = [],
    isLoading = false,
    children,
    emptyMessage,
    ...rest
}) {
    return (
        <TableWrapper
            isLoading={isLoading}
            isEmpty={!isLoading && (!data || data.length === 0)}
            emptyMessage={emptyMessage}
            {...rest}
        >
            {children}
        </TableWrapper>
    );
}
