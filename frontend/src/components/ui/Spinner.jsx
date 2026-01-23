// src/components/ui/Spinner.jsx

import React from 'react';

/**
 * 一个全屏居中的加载指示器组件，适配项目的 Tailwind 和暗色模式风格。
 * @param {object} props
 * @param {string} [props.size='md'] - 尺寸，可选 'sm', 'md', 'lg'。
 * @param {string} [props.color='blue'] - 颜色，可选 'blue', 'gray', 'white'。
 * @param {string} [props.label='Loading...'] - 屏幕阅读器显示的文本。
 */
const Spinner = ({ size = 'md', color = 'blue', label = 'Loading...' }) => {
    // 根据尺寸定义样式
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
    };

    // 根据颜色定义样式，并支持暗色模式
    const colorClasses = {
        blue: 'border-blue-500 border-t-transparent dark:border-blue-400',
        gray: 'border-gray-500 border-t-transparent dark:border-gray-400',
        white: 'border-white border-t-transparent',
    };

    return (
        // 全屏容器，使用 flexbox 居中内容
        // 背景色与你的 .page-bg 类保持一致
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
            <div className="flex flex-col items-center space-y-4">
                {/* 加载动画圆环 */}
                <div
                    className={`animate-spin rounded-full border-4 ${sizeClasses[size]} ${colorClasses[color]}`}
                    role="status"
                    aria-live="polite"
                >
                    {/* 这个 span 是为屏幕阅读器准备的，视觉上隐藏 */}
                    <span className="sr-only">{label}</span>
                </div>

                {/* 可选的加载文本，视觉上可见 */}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {label}
                </p>
            </div>
        </div>
    );
};

export default Spinner;
