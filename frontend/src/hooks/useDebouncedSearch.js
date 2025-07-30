// src/hooks/useDebouncedSearch.js
import {useState, useEffect} from 'react';

/**
 * 带防抖的搜索 Hook
 * @param {Function} onSearch - 搜索函数，接收 keyword 参数
 * @param {number} delay - 防抖延迟时间（毫秒）
 * @returns {[string, Function]} [keyword, setKeyword]
 */
export function useDebouncedSearch(onSearch, delay = 300) {
    const [keyword, setKeyword] = useState('');

    useEffect(() => {
        // 只有当 keyword 变化时才启动防抖
        if (keyword === '') {
            // 立即触发空搜索（通常用于清空结果）
            onSearch('');
            return;
        }

        const handler = setTimeout(() => {
            onSearch(keyword);
        }, delay);

        // // 立即触发搜索（用于按钮点击等）
        // const triggerSearch = useCallback(() => {
        //     onSearch(keyword);
        // }, [keyword, onSearch]);


        // 清理上一个定时器
        return () => clearTimeout(handler);
    }, [keyword, onSearch, delay]); // 依赖 onSearch 和 delay

    return [keyword, setKeyword
        // , {
        //     triggerSearch, // 可手动触发立即搜索
        // }
        ];
}

// 也可以导出默认
// export default useDebouncedSearch;