// src/components/search/FundSearchBox.jsx
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function FundSearchBox({ onSearch }) {
    const [keyword, setKeyword] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => onSearch(keyword), 300);
        return () => clearTimeout(timer);
    }, [keyword, onSearch]);

    return (
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
                type="text"
                placeholder="搜索基金代码/名称"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
    );
}