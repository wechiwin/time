// src/hooks/useHoldingList.js
import {useCallback, useEffect, useState, useMemo} from 'react';
import useApi from '../useApi';

export default function useHoldingList(options = {}) {
    const {
        keyword = '',
        page = 1,
        perPage = 10,
        autoLoad = true,
        refreshKey = 0,
        ho_status = [],
        ho_type = [],
        nav_date = null
    } = options;

    // 业务层管理数据状态
    const [data, setData] = useState(null);
    const {loading, error, get, post, download} = useApi();
    const urlPrefix = '/holding';

    // 搜索函数 - 业务层设置数据
    const searchPage = useCallback(async (params = {}) => {
        const payload = {
            keyword: params.keyword ?? keyword,
            page: params.page ?? page,
            perPage: params.perPage ?? perPage,
            start_date: params.start_date ?? (nav_date?.[0] ?? null),
            end_date: params.end_date ?? (nav_date?.[1] ?? null),
            ho_status: params.ho_status ?? ho_status,
            ho_type: params.ho_type ?? ho_type,
        };

        const result = await post(urlPrefix + '/page_holding', payload);
        setData(result);
        return result;
    }, [
        post,
        keyword,
        page,
        perPage,
        JSON.stringify(nav_date),     // 引用类型需序列化比较
        JSON.stringify(ho_status),
        JSON.stringify(ho_type)
    ]);

    // 自动根据参数变化加载数据
    useEffect(() => {
        if (autoLoad) {
            searchPage();
        }
    }, [keyword, page, perPage, autoLoad, refreshKey, ho_status, ho_type, nav_date, searchPage]);

    // 搜索函数 - 业务层设置数据
    const listHolding = useCallback(async (body) => {
        const result = await post(urlPrefix + '/list_ho', body);
        setData(result);  // 业务逻辑设置 data
        return result;
    }, [get]);

    // 添加基金
    const add = useCallback(async (body) => {
        const result = await post(urlPrefix + '/add_ho', body);
        // 添加成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    /**
     * 检查级联删除信息。
     * @param {number} id - The ID of the holding to check.
     * @returns {Promise<object>} - A promise that resolves to the cascade info object.
     */
    const checkCascadeDelete = useCallback(async (id) => {
        // 调用 del_ho 接口，但附带 dry_run=true 参数
        return await post(urlPrefix + '/del_ho', {id, dry_run: true});
    }, [post]);

    /**
     * 执行删除操作。
     * @param {number} id - The ID of the holding to remove.
     * @returns {Promise<any>}
     */
    const remove = useCallback(async (id) => {
        // 调用 del_ho 接口，不带 dry_run 参数
        const result = await post(urlPrefix + '/del_ho', {id});
        // 删除成功后，建议由调用方（Page组件）决定何时刷新，而不是在这里自动刷新
        // 这样可以让 Page 组件处理分页逻辑（如删除最后一项后返回上一页）
        return result;
    }, [post]);
    // 更新基金
    const update = useCallback(async (body) => {
        const result = await post(urlPrefix + '/update_ho', body);
        // 更新成功后重新搜索当前页面
        await searchPage(keyword, page, perPage);
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    // 下载模板
    const downloadTemplate = useCallback(async () => {
        const url = urlPrefix + '/template';
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
        const result = await post(urlPrefix + '/import', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        return result;
    }, [post, searchPage, keyword, page, perPage]);

    const getById = useCallback(async (id) => {
        const result = await post(urlPrefix + '/get_ho', {id});
        setData(result);
        return result;
    }, [post]);

    const crawlFundInfo = useCallback(
        async (fundCode) => {
            const formData = new FormData();
            formData.append('ho_code', fundCode);
            const res = await post(urlPrefix + '/crawl_fund', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            return res;
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
        downloadTemplate,
        importData,
        getById,
        crawlFundInfo,
        checkCascadeDelete,
    };
}