// src/components/common/SearchBar.jsx
import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import useDebounce from "../../hooks/useDebounce";

/**
 * 通用搜索栏组件
 * @param {object} props
 * @param {string} props.placeholder - 输入框的占位符
 * @param {function(string): void} props.onSearch - 当搜索被触发时的回调函数，接收搜索关键词
 * @param {React.ReactNode} [props.actions] - 可选的，渲染在搜索栏右侧的操作按钮组
 * @param {number} [props.debounceDelay=500] - 防抖延迟时间（毫秒）
 */
function SearchBar({placeholder, onSearch, actions, debounceDelay = 500}) {
    // 组件内部管理输入框的即时值
    const [inputValue, setInputValue] = useState('');
    // 使用防抖Hook，延迟触发 onSearch
    const debouncedInputValue = useDebounce(inputValue, debounceDelay);
    const onSearchRef = useRef(onSearch);

    // 每次渲染都更新 ref
    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);

    useEffect(() => {
        // 始终调用最新的函数
        onSearchRef.current(debouncedInputValue);
        // 依赖数组中只放 debouncedInputValue，确保只有值变化时才触发搜索
    }, [debouncedInputValue]);

    // 处理手动搜索（点击按钮或按回车）
    const handleManualSearch = useCallback(() => {
        // 立即触发搜索，不等待防抖
        onSearch(inputValue);
    }, [inputValue, onSearch]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleManualSearch();
        }
    };

    return (
        <div className="search-bar">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="search-input"
            />
            <button onClick={handleManualSearch} className="btn-primary">
                {/* 可以通过props传入按钮文本，或者使用国际化 */}
                {/* 这里为了通用性，暂时硬编码 */}
                搜索
            </button>

            {/* 如果传入了 actions，则渲染在右侧 */}
            {actions && (
                <div className="ml-auto flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

// 使用 PropTypes 进行类型检查，提高代码健壮性
SearchBar.propTypes = {
    placeholder: PropTypes.string.isRequired,
    onSearch: PropTypes.func.isRequired,
    actions: PropTypes.node,
    debounceDelay: PropTypes.number,
};

export default SearchBar;
