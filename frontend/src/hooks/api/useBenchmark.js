// src/hooks/api/useBenchmark.js
import {useCallback, useState} from 'react';
import useApi from '../useApi';

/**
 * Custom hook for benchmark-related API operations.
 * Provides methods to fetch benchmark data for user settings and analytics.
 */
export default function useBenchmark() {
    const [data, setData] = useState(null);
    const [benchmarks, setBenchmarks] = useState([]);
    const {loading, error, get} = useApi();

    const urlPrefix = '/benchmark';

    /**
     * Fetch the list of available benchmarks for user selection.
     * Used in UserSettingForm to populate the benchmark dropdown.
     *
     * @returns {Promise<Array<{id: number, bm_code: string, bm_name: string}>>}
     *          Array of benchmark objects
     * @throws {Error} If the request fails
     */
    const fetchBenchmarkList = useCallback(async () => {
        try {
            const result = await get(`${urlPrefix}/list_benchmark`);
            setBenchmarks(result || []);
            return result || [];
        } catch (err) {
            console.error('[useBenchmark] fetchBenchmarkList failed:', err);
            throw new Error(err);
        }
    }, [get]);

    return {
        data,
        benchmarks,
        loading,
        error,
        fetchBenchmarkList,
        setData,
        setBenchmarks
    };
}
