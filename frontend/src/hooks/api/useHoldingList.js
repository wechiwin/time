// src/hooks/useHoldingList.js
import {useCallback, useEffect, useState, useMemo} from 'react';
import useApi from '../useApi';

export default function useHoldingList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();

    const getByParam = useCallback(
        async ({ho_name, ho_code, ho_type}, currentPage = 1, currentPerPage = 10) => {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                per_page: currentPerPage.toString(),
                ...Object.fromEntries(
                    Object.entries({ho_name, ho_code, ho_type}).filter(([, v]) => v)
                )
            }).toString();
            const result = await get(`/api/holding/searchPage?${params}`);
            setData(result);
            return result;
        },
        [get]
    );

    // 搜索函数 - 业务层设置数据
    const searchList = useCallback(async (searchKeyword = '') => {
        const params = new URLSearchParams({
            keyword: searchKeyword
        }).toString();
        const result = await get(`/api/holding/search_list?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 搜索函数 - 业务层设置数据
    const searchPage = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10) => {
        const params = new URLSearchParams({
            keyword: encodeURIComponent(searchKeyword),
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/api/holding/search_page?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            searchPage(keyword, page, perPage);
        }
    }, [keyword, page, perPage, autoLoad, searchPage]);

    // 添加基金
    const add = useCallback(async (body) => {
        const result = await post('/api/holding', body);
        // 添加成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    // 删除基金
    const remove = useCallback(async (ho_id) => {
        const result = await del(`/api/holding/${ho_id}`);
        // 删除成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [del, searchPage, keyword, page, perPage]);

    // 更新基金
    const update = useCallback(async ({ho_id, ...body}) => {
        const result = await put(`/api/holding/${ho_id}`, body);
        // 更新成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [put, searchPage, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(() => {
        window.location.href = '/api/holding/template';
    }, []);

    const importData = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const result = await post('/api/holding/import', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        // 导入成功后重新搜索
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const getByCode = useCallback(async (ho_code = '') => {
        const params = new URLSearchParams({
            ho_code: ho_code
        }).toString();
        const result = await get(`/api/holding/${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    const crawlFundInfo = useCallback(
        async (fundCode) => {
            const formData = new FormData();
            formData.append('ho_code', fundCode);
            const res = await post('/api/holding/crawl', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            return res; // { ho_code, ho_name, ho_type, establish_date, ... }
        },
        [post]
    );

    return {
        data,
        loading,
        error,
        add,
        remove,
        searchPage,
        searchList,
        update,
        getByParam,
        downloadTemplate,
        importData,
        getByCode,
        crawlFundInfo,
    };
}