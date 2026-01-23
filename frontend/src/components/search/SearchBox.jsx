import {MagnifyingGlassIcon, XMarkIcon} from "@heroicons/react/24/outline";

export default function SearchBox({
                                      value,
                                      onChange,
                                      placeholder = '搜索...',
                                      onSearchNow,
                                      rightIcon,
                                      onClear, // 新增：清空回调
                                      className = '',
                                      disabled = false, // 接收 disabled
                                      title,
                                      ...props
                                  }) {
    return (
        <div className={`relative ${className}`}>
            <MagnifyingGlassIcon
                className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-200"/>

            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                title={title}
                className={`w-full pl-8 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                 ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                {...props}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                {/* 如果有 onClear 且有值且未禁用，显示清空按钮 */}
                {onClear && value && !disabled ? (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="清空"
                    >
                        <XMarkIcon className="w-4 h-4"/>
                    </button>
                ) : (
                    // 否则显示传入的 rightIcon (如果有)
                    rightIcon
                )}
            </div>
        </div>
    );
}