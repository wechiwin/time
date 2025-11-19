// src/hooks/useTradeList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useTradeList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();

    const search = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10) => {
        const params = new URLSearchParams({
            keyword: encodeURIComponent(searchKeyword),
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/api/trade?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            search(keyword, page, perPage);
        }
    }, [keyword, page, perPage, autoLoad, search]);

    const add = useCallback(async (body) => {
        const result = await post('/api/trade', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(`/api/trade/${id}`);
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async ({id, ...body}) => {
        const result = await put(`/api/trade/${id}`, body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(() => {
        window.location.href = '/api/trade/template';
    }, []);

    const importData = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return post('/api/trade/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }, [post]);

    const listByCode = useCallback(async (ho_code = '') => {
        const params = new URLSearchParams({
            ho_code: ho_code
        }).toString();
        const result = await get(`/api/trade/list_by_code?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    return {data, loading, error, add, remove, update, search, downloadTemplate, importData, listByCode};
}