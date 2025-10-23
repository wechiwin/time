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
        async ({fund_name, fund_code, fund_type}, currentPage = 1, currentPerPage = 10) => {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                per_page: currentPerPage.toString(),
                ...Object.fromEntries(
                    Object.entries({fund_name, fund_code, fund_type}).filter(([, v]) => v)
                )
            }).toString();
            const result = await get(`/api/holdings/searchPage?${params}`);
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
        const result = await get(`/api/holdings/searchList?${params}`);
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
        const result = await get(`/api/holdings/searchPage?${params}`);
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
        const result = await post('/api/holdings', body);
        // 添加成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    // 删除基金
    const remove = useCallback(async (id) => {
        const result = await del(`/api/holdings/${id}`);
        // 删除成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [del, searchPage, keyword, page, perPage]);

    // 更新基金
    const update = useCallback(async ({id, ...body}) => {
        const result = await put(`/api/holdings/${id}`, body);
        // 更新成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [put, searchPage, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(() => {
        window.location.href = '/api/holdings/template';
    }, []);

    const importData = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const result = await post('/api/holdings/import', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        // 导入成功后重新搜索
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

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
        importData
    };
}