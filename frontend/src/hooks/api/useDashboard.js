// src/hooks/api/useDashboard.js
import { useCallback, useEffect, useState } from 'react';
import useApi from '../useApi';

export default function useDashboard(options = {}) {
    const {
        autoLoad = true,
        days = 30
    } = options;

    const [data, setData] = useState(null);
    const { loading, error, get } = useApi();

    const fetchDashboardData = useCallback(async (currentDays = days) => {
        try {
            const result = await get(`/dashboard/summary?days=${currentDays}`);
            setData(result?.data || null);
            return result;
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            throw err;
        }
    }, [get, days]);

    useEffect(() => {
        if (autoLoad) {
            fetchDashboardData(days);
        }
    }, [autoLoad, fetchDashboardData, days]);

    return {
        data,
        loading,
        error,
        fetchDashboardData,
        setData
    };
}
