import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useAlertList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true,
        mode = 'rule', // 'rule' or 'history'
        refreshKey
    } = options;

    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del} = useApi();

    const searchPage = useCallback(async (params = {}) => {
        const currentMode = params.mode ?? mode;
        let payload = {keyword, page, perPage, ...params};

        // 根据模式追加不同参数
        if (currentMode === 'rule') {
            if (params.ar_is_active !== undefined && params.ar_is_active !== '') {
                payload = {...payload, ar_is_active: params.ar_is_active};
            }
            if (params.ar_type) payload = {...payload, ar_type: params.ar_type};
        } else {
            if (params.ah_status) payload = {...payload, ah_status: params.ah_status};
        }

        const endpoint = currentMode === 'rule' ? '/alert/rule/page_rule' : '/alert/history/page_rule_his';
        const result = await post(endpoint, payload);
        setData(result);
        return result;
    }, [post, mode, keyword, page, perPage]);

    useEffect(() => {
        if (autoLoad) {
            searchPage();
        }
    }, [keyword, page, perPage, autoLoad, searchPage, mode, refreshKey]);

    // AlertRule 操作
    const addRule = useCallback(async (body) => {
        const result = await post('/alert/rule', body);
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const updateRule = useCallback(async (body) => {
        const result = await post('/alert/rule/update_rule', body);
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const deleteRule = useCallback(async (id) => {
        const result = await post('/alert/rule/del_rule', {id});
        await searchPage(keyword, page, perPage, 'rule');
        return result;
    }, [post, searchPage, keyword, page, perPage]);

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
