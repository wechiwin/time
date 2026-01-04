// src/hooks/useHoldingList.js
import {useCallback, useEffect, useState, useMemo} from 'react';
import useApi from '../useApi';

export default function useHoldingList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, put, del, download} = useApi();
    const urlPrefix = '/holding';

    const getByParam = useCallback(
        async ({ho_name, ho_code, ho_type}, currentPage = 1, currentPerPage = 10) => {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                per_page: currentPerPage.toString(),
                ...Object.fromEntries(
                    Object.entries({ho_name, ho_code, ho_type}).filter(([, v]) => v)
                )
            }).toString();
            const result = await get(`/searchPage?${params}`);
            setData(result);
            return result;
        },
        [get]
    );

    // 搜索函数 - 业务层设置数据
    const listHolding = useCallback(async (body) => {
        const result = await post(`${urlPrefix}/search_list?${params}`, body);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 搜索函数 - 业务层设置数据
    const searchPage = useCallback(async (searchKeyword = '', currentPage = 1, currentPerPage = 10) => {
        const params = new URLSearchParams({
            keyword: searchKeyword,
            page: currentPage.toString(),
            per_page: currentPerPage.toString()
        }).toString();
        const result = await get(`/holding/search_page?${params}`);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            searchPage(keyword, page, perPage);
        }
    }, [keyword, page, perPage, autoLoad, searchPage]);

    // 添加基金
    const add = useCallback(async (body) => {
        const result = await post('/holding', body);
        // 添加成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    // 删除基金
    const remove = useCallback(async (ho_id) => {
        const result = await del(`/holding/${ho_id}`);
        // 删除成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [del, searchPage, keyword, page, perPage]);

    // 更新基金
    const update = useCallback(async (body) => {
        const result = await post(`/holding/edit`, body);
        // 更新成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(async () => {
        const url = '/holding/template';
        const filename = 'HoldingInfoImportTemplate.xlsx';

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
        const result = await post('/holding/import', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        // 导入成功后重新搜索
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const getById = useCallback(async (id) => {
        const result = await post(`${urlPrefix}/get_by_id`, {id});
        setData(result);
        return result;
    }, [post]);

    const crawlFundInfo = useCallback(
        async (fundCode) => {
            const formData = new FormData();
            formData.append('ho_code', fundCode);
            const res = await post('/holding/crawl_fund', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            return res; // { ho_code, ho_name, ho_type, establish_date, ... }
        },
        [post]
    );

    return {
        data,
        loading,
        error,
        add,
        remove,
        searchPage,
        listHolding,
        update,
        getByParam,
        downloadTemplate,
        importData,
        getById,
        crawlFundInfo,
    };
}