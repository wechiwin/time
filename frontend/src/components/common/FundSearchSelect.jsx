// src/components/common/FundSearchSelect.jsx
import {useState, useEffect} from 'react';
import axios from 'axios';
import {ChevronUpDownIcon} from '@heroicons/react/24/outline';
import {useDebounce} from '../../hooks/useDebounce';

export default function FundSearchSelect({value, onChange}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [list, setList] = useState([]);
    const debounced = useDebounce(q, 600);

    useEffect(() => {
        if (!debounced) return setList([]);
        axios.get(`/api/holdings/search?q=${debounced}`).then((res) => setList(res.data));
    }, [debounced]);

    return (
        <div className="relative">
            <div className="relative">
                <input
                    value={value}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="搜索基金代码"
                    className="input-field" // 已封装好的类名，包含暗黑模式
                />
                <ChevronUpDownIcon className="absolute right-3 top-1/2 w-5 h-5 text-gray-400 dark:text-gray-200"/>
            </div>
            {open && (
                <div className="absolute z-10 mt-1 w-full card border rounded-md shadow-lg max-h-60 overflow-auto">
                    {list.length ? (
                        list.map((f) => (
                            <div
                                key={f.id}
                                className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
                                onMouseDown={() => {
                                    onChange(f.fund_code);
                                    setQ(f.fund_code);
                                }}
                            >
                                {f.fund_code} - {f.fund_name}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-200">无匹配基金</div>
                    )}
                </div>
            )}
        </div>
    );
}