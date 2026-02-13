// src/components/search/HoldingSearchBox.jsx
import {useState, useEffect} from 'react';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import {useTranslation} from "react-i18next";

export default function HoldingSearchBox({onSearch}) {
    const {t} = useTranslation();
    const [keyword, setKeyword] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => onSearch(keyword), 300);
        return () => clearTimeout(timer);
    }, [keyword, onSearch]);

    return (
        <div className="relative">
            <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-200"/>
            <input
                type="text"
                placeholder={t('placeholder_fund_search')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
        </div>
    );
}