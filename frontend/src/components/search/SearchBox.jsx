// src/components/search/SearchBox.jsx
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";

export default function SearchBox({
                                      value,
                                      onChange,
                                      placeholder = '搜索...',
                                      onSearchNow,
                                      rightIcon,
                                      className = '',
                                      inputProps = {}, // ✅ 新增
                                      ...props
                                  }) {
    return (
        <div className={`relative ${className}`}>
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-200" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                {...inputProps} // ✅ 把 onFocus/onBlur 放这里
                {...props}
            />
            {rightIcon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {rightIcon}
                </div>
            )}
            {onSearchNow && !rightIcon && (
                <button
                    type="button"
                    onClick={onSearchNow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 text-sm"
                >
                    搜索
                </button>
            )}
        </div>
    );
}