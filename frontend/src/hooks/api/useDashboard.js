import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useDashboard(options = {}) {
    const {
        autoLoad = true,
        defaultDays = 30,
        defaultWindow = 'R252' // 默认看近一年
    } = options;

    const [summaryData, setSummaryData] = useState(null);
    const [overviewData, setOverviewData] = useState(null);

    const [loading, setLoading] = useState(false);
    const [overviewLoading, setOverviewLoading] = useState(false);

    const [error, setError] = useState(null);

    const {get} = useApi();

    const fetchSummaryData = useCallback(async (days = defaultDays, window = defaultWindow) => {
        setLoading(true);
        setError(null);
        try {
            // 映射前端的时间范围到后端的 Window Key
            // 假设前端传 '30d', '1y' 等，这里做一个简单的转换逻辑，或者直接由组件传 Key
            const result = await get(`/dashboard/summary?days=${days}&window=${window}`);
            setSummaryData(result);
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [get, defaultDays, defaultWindow]);

    const fetchOverviewData  = useCallback(async () => {
        setOverviewLoading(true);
        try {
            const result = await get('/dashboard/overview');
            setOverviewData(result);
        } catch (err) {
            console.error('Failed to fetch overview data:', err);
            setError(err);
        } finally {
            setOverviewLoading(false);
        }
    }, [get]);

    useEffect(() => {
        if (autoLoad) {
            fetchSummaryData();
            fetchOverviewData();
        }
    }, [autoLoad, fetchSummaryData, fetchOverviewData]);

    return {
        data: summaryData,
        overviewData,
        loading,
        overviewLoading,
        error,
        fetchSummaryData,
        fetchOverviewData
    };
}
