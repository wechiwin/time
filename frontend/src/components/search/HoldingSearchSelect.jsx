// src/components/search/HoldingSearchSelect.jsx
import {useEffect, useRef, useState} from 'react';
import SearchBox from './SearchBox';
import useHoldingList from "../../hooks/api/useHoldingList";
import useDebounce from "../../hooks/useDebounce";
import {useTranslation} from "react-i18next";

export default function HoldingSearchSelect({
                                                value,
                                                onChange,
                                                placeholder,
                                                disabled = false,
                                                className = ''
                                            }) {
    const {t} = useTranslation();
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const {data, searchPage} = useHoldingList({autoLoad: false});
    const wrapperRef = useRef(null);
    // 1. 管理输入框的即时值
    const [inputValue, setInputValue] = useState('');
    // 2. 对即时值进行防抖处理，得到用于搜索的关键词
    const debouncedKeyword = useDebounce(inputValue, 500);
    // 3. 管理当前选中的基金对象，用于区分用户输入和程序设置的显示值
    const [selectedFund, setSelectedFund] = useState(null);
    // 4. 使用 useEffect 监听防抖后的关键词变化，并触发搜索
    useEffect(() => {
        // 检查 debouncedKeyword 是否为有效字符串，并且下拉列表是打开状态
        // 增加 open 判断可以避免在选择一项后，因 inputValue 更新而再次触发不必要的搜索
        if (debouncedKeyword && open) {
            // 假设 searchPage 接收一个对象作为参数
            searchPage({keyword: debouncedKeyword, page: 1, perPage: 10});
        } else if (!debouncedKeyword) {
            // 如果关键词为空，清空列表
            setList([]);
        }
    }, [debouncedKeyword, open, searchPage]); // 依赖于防抖后的关键词和下拉框的打开状态

    // 每次外部传入的 value 变化时，同步到内部状态（用于编辑模式回显）
    useEffect(() => {
        if (value && value.ho_code) {
            const displayName = value.ho_short_name
                ? `${value.ho_code} - ${value.ho_short_name}`
                : value.ho_code;
            setInputValue(displayName);
            setSelectedFund(value);
        } else if (typeof value === 'string') { // 兼容旧的字符串传入方式
            setInputValue(value);
            setSelectedFund(null);
        } else {
            setInputValue('');
            setSelectedFund(null);
        }
    }, [value]);

    //  监听点击外部
    useEffect(() => {
        const handleClickOutside = (event) => {
            // console.log('click outside check', event.target);
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                // console.log('close dropdown');
                setOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside, true);   // 捕获阶段
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);

    // 每次 data 更新，刷新 list
    useEffect(() => {
        // console.log('data 更新:', data);
        if (data && data.items) {
            setList(data.items);
        } else {
            setList([]);
        }
    }, [data]);

    // 处理选择基金
    const handleSelectFund = (fund) => {
        setSelectedFund(fund);
        setInputValue(`${fund.ho_code} - ${fund.ho_short_name}`);
        setOpen(false);
        // 通知父组件
        onChange(fund);
    };

    // 新增：处理清空逻辑
    const handleClear = () => {
        setInputValue('');
        setSelectedFund(null);
        setList([]);
        setOpen(false);
        onChange(null); // 通知父组件已清空
        // 清空后通常不需要自动打开下拉框，保持关闭即可，或者根据需求 setOpen(true)
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <SearchBox
                value={inputValue}
                onChange={(val) => {
                    setInputValue(val);
                    // 用户开始输入时，自动打开下拉列表
                    if (!disabled) {
                        setOpen(true);
                    }
                    // 如果用户清空了输入框，也触发清空逻辑
                    if (!val) {
                        handleClear();
                    }
                }}
                placeholder={placeholder || t('placeholder_fund_search_select')}
                onSearchNow={() => searchPage({ keyword: inputValue })}
                disabled={disabled}
                onClear={handleClear}
                title={inputValue}
                onFocus={() => !disabled && inputValue && setOpen(true)} // 点击输入框时如果已有内容也打开
            />
            {open && !disabled && (
                <div className="absolute z-10 mt-1 w-full card border rounded-md shadow-lg max-h-60 overflow-auto">
                    {list.length > 0 ? (
                        list.map((holding) => (
                            <div
                                key={holding.id}
                                className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
                                onMouseDown={() => handleSelectFund(holding)}
                            >
                                <div className="font-medium">{holding.ho_code} - {holding.ho_short_name}</div>
                            </div>
                        ))
                    ) : inputValue ? (
                        <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-200">
                            {t('tl_no_records')}
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-200">
                            {t('msg_search_placeholder')}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
