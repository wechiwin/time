// src/hooks/useNavHistoryList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';
import {DEFAULT_PAGE_SIZE} from "../../constants/sysConst";

export default function useNavHistoryList(options = {}) {
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
            ho_code: searchKeyword,
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/api/nav_history?${params}`);
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
        const result = await post('/api/nav_history', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(`/api/nav_history/${id}`);
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async ({id, ...body}) => {
        const result = await put(`/api/nav_history/${id}`, body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

    const crawl = useCallback(async (body) => {
        const result = await post('/api/nav_history/crawl', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const crawl_all = useCallback(async () => {
        const result = await get('/api/nav_history/crawl_all');
        return result;
    }, [get]);

    const searchList = useCallback(async (ho_code = '', start_date = '', end_date = '') => {
        const params = new URLSearchParams({
            ho_code: ho_code,
            start_date: start_date,
            end_date: end_date,
        }).toString();
        const result = await get(`/api/nav_history/search_list?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    return {data, loading, error, add, remove, update, search, crawl, crawl_all, searchList};
}