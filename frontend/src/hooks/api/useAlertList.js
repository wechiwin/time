import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useAlertList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true,
        mode = 'rule' // 'rule' or 'history'
    } = options;

    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();

    const searchPage = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10, currentMode = mode) => {
        const params = new URLSearchParams({
            keyword: searchKeyword,
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();

        const endpoint = currentMode === 'rule' ? '/alert/rule/search_page' : '/alert/history/search_page';
        const result = await get(`${endpoint}?${params}`);
        setData(result);
        return result;
    }, [get, mode]);

    useEffect(() => {
        if (autoLoad) {
            searchPage(keyword, page, perPage, mode);
        }
    }, [keyword, page, perPage, autoLoad, searchPage, mode]);

    // AlertRule 操作
    const addRule = useCallback(async (body) => {
        const result = await post('/alert/rule', body);
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const updateRule = useCallback(async ({ar_id, ...body}) => {
        const result = await put(`/alert/rule/${ar_id}`, body);
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [put, searchPage, keyword, page, perPage]);

    const deleteRule = useCallback(async (ar_id) => {
        const result = await del(`/alert/rule/${ar_id}`);
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [del, searchPage, keyword, page, perPage]);

    // AlertHistory 操作
    const addHistory = useCallback(async (body) => {
        const result = await post('/alert/history', body);
        await searchPage(keyword, page, perPage, 'history');
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    return {
        data,
        loading,
        error,
        addRule,
        updateRule,
        deleteRule,
        addHistory,
        searchPage,
        setData
    };
}
