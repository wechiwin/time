import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useDashboard(options = {}) {
    const {
        autoLoad = true,
        defaultDays = 30,
        defaultWindow = 'R252'
    } = options;

    const [summaryData, setSummaryData] = useState(null);
    const [overviewData, setOverviewData] = useState(null);

    // 合并初始加载状态
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    // 合并错误状态
    const [error, setError] = useState(null);
    // 用于刷新按钮的独立加载状态
    const [isRefreshing, setIsRefreshing] = useState(false);

    const {get, post} = useApi();
    const urlPrefix = '/dashboard';

    const fetchAllData = useCallback(async (days = defaultDays, window = defaultWindow, isRefresh = false) => {
        // 如果是刷新，使用刷新状态；否则使用初始加载状态
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsInitialLoading(true);
        }
        setError(null);

        try {
            // 使用 Promise.all 并行请求，提高效率
            const [summaryResult, overviewResult] = await Promise.all([
                post(urlPrefix + '/summary', {days, window}),
                get(urlPrefix + '/overview')
            ]);
            setSummaryData(summaryResult);
            setOverviewData(overviewResult);
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setError(err);
            // 出错时，可以不清空现有数据，让用户看到旧数据并提示错误
        } finally {
            setIsInitialLoading(false);
            setIsRefreshing(false);
        }
    }, [post, get, defaultDays, defaultWindow]);

    useEffect(() => {
        if (autoLoad) {
            fetchAllData();
        }
    }, [autoLoad, fetchAllData]);

    return {
        summaryData,
        overviewData,
        isInitialLoading,
        isRefreshing,
        error,
        refetch: fetchAllData // 提供一个统一的刷新函数
    };
}
