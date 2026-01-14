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
    const {loading, error, get, post, put, del, download} = useApi();
    const urlPrefix = '/trade';

    const search = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10) => {
        const params = new URLSearchParams({
            keyword: encodeURIComponent(searchKeyword),
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/trade?${params}`);
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
        const result = await post('/trade', body);
        await search(keyword, page, perPage);
        return result;
    }, [post, search, keyword, page, perPage]);

    const remove = useCallback(async (id) => {
        const result = await del(`/trade/${id}`);
        await search(keyword, page, perPage);
        return result;
    }, [del, search, keyword, page, perPage]);

    const update = useCallback(async ({tr_id, ...body}) => {
        const result = await put(`/trade/${tr_id}`, body);
        await search(keyword, page, perPage);
        return result;
    }, [put, search, keyword, page, perPage]);

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
        const result = await post(`${urlPrefix}/list_by_ho_id`,{ho_id});
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