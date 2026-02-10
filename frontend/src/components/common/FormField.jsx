// src/components/common/FormField.jsx
import React from 'react';

export default function FormField({ label, error, required, children, className = "", labelClassName = "" }) {
    return (
        <div className={`flex flex-col ${className}`}>
            {label && (
                <label className={`text-sm font-medium mb-1 ${labelClassName}`}>
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/*
               关键修复：增加一个 relative 容器。
               这作为 WarningBubble (absolute定位) 的锚点。
               确保气泡出现在 Input 的正下方，而不是 Label 上方或页面底部。
            */}
            <div className="relative w-full">
                {React.Children.map(children, child => {
                    if (!React.isValidElement(child)) return child;

                    // 简单的判断：如果子组件看起来像 WarningBubble（有 warning 属性），
                    // 我们就不给它注入 input 的边框样式。
                    // 注意：生产环境 child.type.name 可能会被混淆，所以用 props 判断更稳妥。
                    const isWarningBubble = child.props.hasOwnProperty('warning') && child.props.hasOwnProperty('onApply');
                    if (isWarningBubble) return child;

                    // 注入错误样式
                    const existingClass = child.props.className || '';
                    // 只有当 error 存在时才添加红色边框
                    const errorClass = error
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400'
                        : '';

                    return React.cloneElement(child, {
                        className: `${existingClass} ${errorClass}`.trim()
                    });
                })}
            </div>

            {/* 错误提示语 (Validation Errors) */}
            {error && (
                <span className="text-xs text-red-500 dark:text-red-400 mt-1 animate-pulse">
                    {error}
                </span>
            )}
        </div>
    );
}
