// src/hooks/useTradeList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useTradeList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true,
        refreshKey = 0,
        tr_type = '',
        start_date = null,
        end_date = null
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del, download} = useApi();
    const urlPrefix = '/trade';

    const search = useCallback(async (params = {}) => {
        let payload = {keyword, page, perPage, tr_type, start_date, end_date, ...params};

        const result = await post(urlPrefix + '/tr_page', {
            keyword: payload.keyword,
            page: payload.page,
            perPage: payload.perPage,
            start_date: payload.start_date,
            end_date: payload.end_date,
            tr_type: payload.tr_type
        });
        setData(result);
        return result;
    }, [post, keyword, page, perPage, tr_type, start_date, end_date]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            search();
        }
    }, [keyword, page, perPage, tr_type, start_date, end_date, autoLoad, search, refreshKey]);

    const add = useCallback(async (body) => {
        const result = await post('/trade', body);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await post(urlPrefix + '/del_tr', {id});
        return result;
    }, [post]);

    const update = useCallback(async ({tr_id, ...body}) => {
        const result = await post(urlPrefix + "/update_tr", body);
        return result;
    }, [post, search, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(async () => {
        const url = '/trade/template';
        const filename = 'TradeImportTemplate.xlsx';

        try {
            await download(url, filename);
        } catch (error) {
            console.error('下载模板失败:', error);
            // 可以在这里添加更具体的错误提示
            throw error;
        }
    }, [download]);

    const importData = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return post('/trade/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }, [post]);

    const listByHoId = useCallback(async (ho_id = '') => {
        const result = await post(`${urlPrefix}/list_by_ho_id`, {ho_id});
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [post]);

    const uploadTradeImg = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return post('/trade/upload', formData, {
            headers: { // 必须包裹在 headers 对象中
                'Content-Type': 'multipart/form-data',
            },
        });
    }, [post]);

    const upload_sse = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        // 注意：这里去掉了手动设置 'Content-Type': 'multipart/form-data'
        // 让浏览器自动生成 boundary
        return post('/trade/upload_sse', formData, {});
    }, [post]);

    return {
        data,
        loading,
        error,
        add,
        remove,
        update,
        search,
        downloadTemplate,
        importData,
        listByHoId,
        uploadTradeImg,
        upload_sse
    };
}