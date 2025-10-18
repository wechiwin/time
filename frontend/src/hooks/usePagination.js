// src/hooks/usePagination.js
import { useState, useCallback } from 'react';

export default function usePagination(defaultPerPage = 10) {
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(defaultPerPage);
    const [searchKeyword, setSearchKeyword] = useState('');

    // 处理页码变化
    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
    }, []);

    // 处理每页数量变化
    const handlePerPageChange = useCallback((newPerPage) => {
        setPerPage(newPerPage);
        setCurrentPage(1); // 重置到第一页
    }, []);

    // 处理搜索
    const handleSearch = useCallback((keyword, page = 1) => {
        setSearchKeyword(keyword);
        setCurrentPage(page);
    }, []);

    // 重置分页状态
    const resetPagination = useCallback(() => {
        setCurrentPage(1);
        setSearchKeyword('');
    }, []);

    // 构建查询参数
    const buildQueryParams = useCallback((additionalParams = {}) => {
        const params = {
            page: currentPage,
            per_page: perPage,
            ...additionalParams
        };

        if (searchKeyword) {
            params.fund_code = searchKeyword;
        }

        return params;
    }, [currentPage, perPage, searchKeyword]);

    // 构建查询字符串
    const buildQueryString = useCallback((additionalParams = {}) => {
        const params = buildQueryParams(additionalParams);
        return new URLSearchParams(params).toString();
    }, [buildQueryParams]);

    return {
        // 状态
        currentPage,
        perPage,
        searchKeyword,

        // 操作方法
        handlePageChange,
        handlePerPageChange,
        handleSearch,
        resetPagination,

        // 状态设置方法
        setCurrentPage,
        setPerPage,
        setSearchKeyword,

        // 工具方法
        buildQueryParams,
        buildQueryString,

        // 分页参数对象（便于直接使用）
        params: {
            page: currentPage,
            per_page: perPage,
            searchKeyword
        }
    };
}