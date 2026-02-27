// src/components/ui/Skeleton.jsx
import React from 'react';

// Simple class name utility
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A unified skeleton component for loading states.
 * Supports multiple variants, sizes, and dark mode.
 *
 * @param {object} props
 * @param {string} [props.variant='text'] - Variant: 'text', 'circular', 'rectangular', 'card'
 * @param {string|number} [props.width] - Width of the skeleton
 * @param {string|number} [props.height] - Height of the skeleton
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.animate=true] - Whether to show pulse animation
 */
const Skeleton = ({
    variant = 'text',
    width,
    height,
    className = '',
    animate = true,
}) => {
    const baseClasses = 'bg-gray-200 dark:bg-gray-700 rounded';
    const animationClass = animate ? 'animate-pulse' : '';

    const variantClasses = {
        text: 'h-4 w-full',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
        card: 'rounded-xl',
    };

    const style = {};
    if (width) {
        style.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height) {
        style.height = typeof height === 'number' ? `${height}px` : height;
    }

    return (
        <div
            className={cn(
                baseClasses,
                variantClasses[variant],
                animationClass,
                className
            )}
            style={style}
            aria-hidden="true"
        />
    );
};

/**
 * Skeleton for text lines
 * @param {number} [props.lines=1] - Number of text lines
 * @param {string} [props.className] - Additional CSS classes
 */
export const TextSkeleton = ({ lines = 1, className = '' }) => {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    className={i === lines - 1 && lines > 1 ? 'w-4/5' : ''}
                />
            ))}
        </div>
    );
};

/**
 * Skeleton for avatar/profile images
 * @param {string|number} [props.size='md'] - Size: 'sm' (32px), 'md' (40px), 'lg' (64px), or custom
 */
export const AvatarSkeleton = ({ size = 'md' }) => {
    const sizeMap = {
        sm: 32,
        md: 40,
        lg: 64,
    };

    const dimension = typeof size === 'number' ? size : sizeMap[size] || 40;

    return (
        <Skeleton
            variant="circular"
            width={dimension}
            height={dimension}
        />
    );
};

export default Skeleton;
