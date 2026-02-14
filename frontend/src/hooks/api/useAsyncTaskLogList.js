// src/hooks/api/useAsyncTaskLogList.js
import {useCallback, useEffect, useState} from 'react';
import useApi from "../useApi";

/**
 * 用于获取异步任务日志列表的 Hook
 * @param {object} params - 查询参数
 * @param {number} params.page - 当前页码
 * @param {number} params.perPage - 每页数量
 * @param {string} params.keyword - 搜索关键字
 * @param {boolean} params.autoLoad - 是否自动加载
 * @param {number} params.refreshKey - 用于手动触发刷新的 key
 * @param {string[]} params.status - 状态筛选数组
 * @param {string[]} params.created_at - 创建日期范围数组
 */
export default function useAsyncTaskLogList({
                                                page,
                                                perPage,
                                                keyword,
                                                autoLoad = true,
                                                refreshKey = 0,
                                                status,
                                                created_at
                                            }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(autoLoad);
    const {loading, error, post, get} = useApi();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = {
                page,
                per_page: perPage,
                keyword,
                status,
                created_at
            };
            const result = await post('/task_log/log_page', payload);
            setData(result);
            return result;
        } catch (err) {
            console.error(`fetchData failed:`, err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [page, perPage, keyword, status, created_at]);

    useEffect(() => {
        if (autoLoad) {
            fetchData();
        }
    }, [fetchData, autoLoad, refreshKey]);

    const redo_all_snapshot = useCallback(async () => {
        const result = await get('/task_log/redo_all_snapshot_job', {});
        return result;
    }, [get]);

    const redo_yesterday_snapshot = useCallback(async () => {
        const result = await get('/task_log/redo_yesterday_snapshot_job', {});
        return result;
    }, [get]);

    const deleteLog = useCallback(async (id) => {
        const result = await post('/task_log/del_log', {id});
        return result;
    }, [post]);

    return {data, isLoading, error, redo_all_snapshot, redo_yesterday_snapshot, deleteLog};
}
