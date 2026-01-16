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

    const searchPage = useCallback(async (params = {}) => {
        const currentMode = params.mode ?? mode;
        let payload = {keyword, page, perPage, ...params};

        // 根据模式追加不同参数
        if (currentMode === 'rule') {
            if (params.ar_is_active !== undefined && params.ar_is_active !== '') {
                payload.append('ar_is_active', params.ar_is_active);
            }
            if (params.ar_type) payload.append('ar_type', params.ar_type);
        } else {
            if (params.ah_status) payload.append('ah_status', params.ah_status);
        }

        const endpoint = currentMode === 'rule' ? '/alert/rule/page_rule' : '/alert/history/page_rule_his';
        const result = await post(endpoint, payload);
        setData(result);
        return result;
    }, [post, mode, keyword, page, perPage]);

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
