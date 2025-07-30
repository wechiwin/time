// src/components/common/FundSearchSelect.jsx
import {useEffect, useRef, useState} from 'react';
import SearchBox from '../search/SearchBox';
import {useDebouncedSearch} from '../../hooks/useDebouncedSearch';
import useFundList from "../../hooks/api/useFundList";

export default function FundSearchSelect({value, onChange, placeholder = '搜索基金'}) {
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const {data, loading, add, remove, search} = useFundList();
    const [keyword, setKeyword] = useDebouncedSearch(search, 500);
    const wrapperRef = useRef(null);

    //  监听点击外部
    useEffect(() => {
        const handleClickOutside = (event) => {
            console.log('click outside check', event.target);
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                console.log('close dropdown');
                setOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside, true);   // 捕获阶段
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);

    // 每次 data 更新，刷新 list
    useEffect(() => {
        setList(data);
    }, [data]);

    // 防抖搜索函数
    const handleSearch = async (keyword) => {
        if (!keyword) {
            setList([]);
            return;
        }
        try {
            await search(keyword);
        } catch (err) {
            console.error('搜索基金失败', err);
            setList([]);
        }
    };


    return (
        <div className="relative" ref={wrapperRef}>
            <SearchBox
                value={keyword}
                onChange={(val) => {
                    setKeyword(val);
                    setOpen(true);
                }}
                placeholder={placeholder}
                onSearchNow={() => handleSearch(keyword)}
            />

            {open && (
                <div className="absolute z-10 mt-1 w-full card border rounded-md shadow-lg max-h-60 overflow-auto">
                    {list.length ? (
                        list.map((f) => (
                            <div
                                key={f.id}
                                className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
                                onMouseDown={() => {
                                    onChange(f.fund_code);
                                    setKeyword(f.fund_code);
                                    setOpen(false);
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
