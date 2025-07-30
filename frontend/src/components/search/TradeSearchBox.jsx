// src/components/search/TradeSearchBox.jsx
import {useState, useEffect} from 'react';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';

export default function TradeSearchBox({onSearch}) {
    const [kw, setKw] = useState('');
    useEffect(() => {
        const t = setTimeout(() => onSearch(kw), 300);
        return () => clearTimeout(t);
    }, [kw, onSearch]);
    return (
        <div className="relative">
            <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-200"/>
            <input
                type="text"
                placeholder="搜索基金代码"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
        </div>
    );
}