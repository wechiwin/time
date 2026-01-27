// src/hooks/useNavHistoryList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';
import {DEFAULT_PAGE_SIZE} from "../../constants/sysConst";

export default function useNavHistoryList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = DEFAULT_PAGE_SIZE,
        autoLoad = true,
        refreshKey = 0
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();
    const urlPrefix = '/nav_history';

    const search = useCallback(async (params = {}) => {
        const result = await post(urlPrefix + '/page_history', {
            keyword: params.keyword || keyword,
            page: params.page || page,
            per_page: params.perPage || perPage,
            start_date: params.start_date || null,
            end_date: params.end_date || null
        });
        setData(result);
        return result;
    }, [post, keyword, page, perPage]);

    const list_history = useCallback(async (ho_id = '', start_date = '', end_date = '') => {
        const payload = {ho_id};
        if (start_date) payload.start_date = start_date;
        if (end_date) payload.end_date = end_date;

        const result = await post(urlPrefix + '/list_history', payload);
        return result;
    }, [post]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            search({
                keyword,
                page,
                perPage,
                start_date: options.start_date,
                end_date: options.end_date
            });
        }
    }, [keyword, page, perPage, options.start_date, options.end_date, autoLoad, search, refreshKey]);

    const add = useCallback(async (body) => {
        const result = await post('/nav_history', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(urlPrefix + '/del_nav', {id});
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async (body) => {
        const result = await put(urlPrefix + '/update_nav', body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

    const crawl = useCallback(async (body) => {
        const result = await post(urlPrefix + '/crawl', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const crawl_all = useCallback(async () => {
        const result = await get(urlPrefix + '/crawl_all');
        return result;
    }, [get]);

    return {
        data, loading, error, add, remove, update, search,
        crawl, crawl_all, list_history
    };
}