// 气泡提示组件
import {CheckCircleIcon, ExclamationTriangleIcon} from "@heroicons/react/24/outline";
import {useTranslation} from "react-i18next";

export default function WarningBubble({warning, onApply}) {
    const {t} = useTranslation()
    if (!warning) return null;

    // 解构 warning 对象，兼容旧逻辑（如果只是字符串）
    const message = typeof warning === 'string' ? warning : warning.message;
    const suggestedValue = typeof warning === 'object' ? warning.suggestedValue : null;

    return (
        <div className="absolute z-20 left-0 -bottom-1 translate-y-full w-full">
            <div
                className="relative bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-md p-2 shadow-lg flex flex-col gap-1">
                {/* 小三角箭头 */}
                <div
                    className="absolute -top-1.5 left-4 w-3 h-3 bg-orange-50 border-t border-l border-orange-200 transform rotate-45"></div>
                <div className="flex items-start gap-1.5">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600"/>
                    <span className="leading-tight">{message}</span>
                </div>

                {/* 应用按钮：只有存在建议值时才显示 */}
                {suggestedValue !== null && suggestedValue !== undefined && (
                    <button
                        type="button"
                        onClick={() => onApply(suggestedValue)}
                        className="mt-1 flex items-center justify-center gap-1 w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-1 px-2 rounded transition-colors text-xs font-medium border border-orange-200"
                    >
                        <CheckCircleIcon className="w-3.5 h-3.5"/>
                        {t('apply')} {suggestedValue}
                    </button>
                )}
            </div>
        </div>
    );
};
