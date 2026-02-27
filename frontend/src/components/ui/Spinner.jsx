// src/components/ui/Spinner.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A loading indicator component with full-screen or inline modes.
 * Supports Tailwind CSS and dark mode.
 *
 * @param {object} props
 * @param {string} [props.size='md'] - Size: 'sm', 'md', 'lg'
 * @param {string} [props.color='blue'] - Color: 'blue', 'gray', 'white'
 * @param {string} [props.label] - Label text (uses i18n 'loading' by default)
 * @param {boolean} [props.inline=false] - If true, renders inline instead of full-screen overlay
 * @param {string} [props.className] - Additional CSS classes (for inline mode)
 */
const Spinner = ({
    size = 'md',
    color = 'blue',
    label,
    inline = false,
    className = '',
}) => {
    const { t } = useTranslation();
    const displayLabel = label || t('loading');

    // Size classes for the spinner circle
    const sizeClasses = {
        sm: 'w-5 h-5 border-2',
        md: 'w-10 h-10 border-4',
        lg: 'w-16 h-16 border-4',
    };

    // Color classes with dark mode support
    const colorClasses = {
        blue: 'border-blue-500 border-t-transparent dark:border-blue-400',
        gray: 'border-gray-500 border-t-transparent dark:border-gray-400',
        white: 'border-white border-t-transparent',
    };

    // Text color classes
    const textColorClasses = {
        blue: 'text-blue-600 dark:text-blue-400',
        gray: 'text-gray-600 dark:text-gray-400',
        white: 'text-white',
    };

    const spinnerElement = (
        <div
            className={cn(
                'animate-spin rounded-full',
                sizeClasses[size],
                colorClasses[color]
            )}
            role="status"
            aria-live="polite"
        >
            <span className="sr-only">{displayLabel}</span>
        </div>
    );

    // Inline mode: just the spinner with optional label
    if (inline) {
        return (
            <div className={cn('flex items-center gap-3', className)}>
                {spinnerElement}
                <span className={cn('text-sm', textColorClasses[color])}>
                    {displayLabel}
                </span>
            </div>
        );
    }

    // Full-screen mode (default)
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
            <div className="flex flex-col items-center space-y-4">
                {spinnerElement}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {displayLabel}
                </p>
            </div>
        </div>
    );
};

/**
 * Centered inline spinner for container loading states
 * @param {object} props
 * @param {string} [props.size='md'] - Size
 * @param {string} [props.label] - Label text
 * @param {string} [props.className] - Additional classes
 */
export const CenteredSpinner = ({ size = 'md', label, className = '' }) => {
    const { t } = useTranslation();
    const displayLabel = label || t('loading');

    const sizeClasses = {
        sm: 'w-5 h-5 border-2',
        md: 'w-10 h-10 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className={cn('flex flex-col items-center justify-center py-12', className)}>
            <div
                className={cn(
                    'animate-spin rounded-full border-blue-500 border-t-transparent dark:border-blue-400',
                    sizeClasses[size]
                )}
                role="status"
                aria-live="polite"
            >
                <span className="sr-only">{displayLabel}</span>
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {displayLabel}
            </p>
        </div>
    );
};

export default Spinner;
