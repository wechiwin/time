// src/hooks/useNetValueList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';
import {DEFAULT_PAGE_SIZE} from "../../constants/sysConst";

export default function useNetValueList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = DEFAULT_PAGE_SIZE,
        autoLoad = true
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();

    // 修改search方法，接收查询字符串
    const search = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10) => {
        const params = new URLSearchParams({
            keyword: searchKeyword,
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/api/net_values?${params}`);
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
        const result = await post('/api/net_values', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(`/api/net_values/${id}`);
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async ({id, ...body}) => {
        const result = await put(`/api/net_values/${id}`, body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

    const crawl = useCallback(async (body) => {
        const result = await post('/api/net_values/crawl', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const crawl_all = useCallback(async () => {
        const result = await post('/api/net_values/crawl_all');
        return result;
    }, [post, search, keyword, page, perPage]);

    return {data, loading, error, add, remove, update, search, crawl, crawl_all};
}