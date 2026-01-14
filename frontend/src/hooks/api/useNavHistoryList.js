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
    const urlPrefix = '/nav_history';

    // 修改search方法，接收查询字符串
    const search = useCallback(async (ho_id = '', page = 1, per_page = 10) => {
        const result = await post(`${urlPrefix}/page_history`, {ho_id, page, per_page});
        setData(result);
        return result;
    }, [post]);

    const list_history = useCallback(async (ho_id = '', start_date = '', end_date = '') => {
        const result = await post(`${urlPrefix}/list_history`, {ho_id, start_date, end_date});
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
        const result = await post('/nav_history', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(`/nav_history/${id}`);
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async ({id, ...body}) => {
        const result = await put(`/nav_history/${id}`, body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

    const crawl = useCallback(async (body) => {
        const result = await post('/nav_history/crawl', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const crawl_all = useCallback(async () => {
        const result = await get('/nav_history/crawl_all');
        return result;
    }, [get]);

    const getLatestNav = useCallback(async (searchKeyword = '') => {
        const params = new URLSearchParams({
            ho_code: searchKeyword,
            page: 1,
            per_page: 1
        }).toString();
        const result = await get(`/nav_history?${params}`);
        // console.log(result)
        const latestNav = result.items[0]
        setData(latestNav);
        // console.log(latestNav)
        return latestNav;
    }, [get]);

    return {data, loading, error, add, remove, update, search, crawl, crawl_all, list_history, getLatestNav};
}