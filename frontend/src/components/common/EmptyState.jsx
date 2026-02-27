import React from 'react';
import { InboxIcon } from "@heroicons/react/24/outline/index";
import { useTranslation } from "react-i18next";

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A component to display when there's no data to show.
 * Supports custom icons, sizes, and action buttons.
 *
 * @param {object} props
 * @param {string} [props.message] - Main message to display (uses i18n 'msg_no_records' by default)
 * @param {string} [props.hint] - Optional hint text below the main message
 * @param {React.ComponentType} [props.icon] - Custom icon component (defaults to InboxIcon)
 * @param {string} [props.size='md'] - Size: 'sm', 'md', 'lg'
 * @param {React.ReactNode} [props.action] - Optional action button/element
 * @param {string} [props.className] - Additional CSS classes
 */
export default function EmptyState({
    message,
    hint,
    icon: IconComponent,
    size = 'md',
    action,
    className = '',
}) {
    const { t } = useTranslation();
    const CurrentIcon = IconComponent || InboxIcon;
    const displayMessage = message || t('msg_no_records');

    // Size configurations
    const sizeConfig = {
        sm: {
            container: 'py-6',
            icon: 'h-8 w-8',
            title: 'text-sm',
            hint: 'text-xs',
            gap: 'space-y-2',
        },
        md: {
            container: 'py-12',
            icon: 'h-12 w-12',
            title: 'text-base',
            hint: 'text-sm',
            gap: 'space-y-3',
        },
        lg: {
            container: 'py-16',
            icon: 'h-16 w-16',
            title: 'text-lg',
            hint: 'text-base',
            gap: 'space-y-4',
        },
    };

    const config = sizeConfig[size] || sizeConfig.md;

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                'bg-gray-50 dark:bg-gray-800/50 rounded-lg',
                'border border-gray-100 dark:border-gray-700',
                config.container,
                config.gap,
                className
            )}
        >
            <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                <CurrentIcon className={cn(config.icon, 'text-gray-400 dark:text-gray-500')} />
            </div>

            <div className="max-w-sm">
                <p className={cn('text-gray-500 dark:text-gray-400', config.title)}>
                    {displayMessage}
                </p>

                {hint && (
                    <p className={cn('text-gray-400 dark:text-gray-500 mt-1', config.hint)}>
                        {hint}
                    </p>
                )}
            </div>

            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
}

/**
 * Compact EmptyState for inline use in tables or small containers
 */
export function EmptyStateCompact({ message, className = '' }) {
    const { t } = useTranslation();
    const displayMessage = message || t('msg_no_records');

    return (
        <div className={cn('text-center py-8 text-gray-500 dark:text-gray-400', className)}>
            <p className="text-sm">{displayMessage}</p>
        </div>
    );
}
