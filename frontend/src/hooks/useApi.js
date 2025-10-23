import {useCallback, useEffect, useState} from 'react';
import apiClient from '../api/client.js';

export default function useApi(endpoint, options = {}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 通用请求方法
    const request = useCallback(async (url, method = 'GET', body = null) => {
        try {
            setLoading(true);
            setError(null);

            let response;
            switch (method) {
                case 'GET':
                    response = await apiClient.get(url);
                    break;
                case 'POST':
                    response = await apiClient.post(url, body);
                    break;
                case 'PUT':
                    response = await apiClient.put(url, body);
                    break;
                case 'DELETE':
                    response = await apiClient.delete(url);
                    break;
                default:
                    throw new Error(`Unsupported method: ${method}`);
            }

            return response;
        } catch (err) {
            const msg = err.message || '请求失败';
            setError(msg);
            console.error(`[useApi] 请求错误: ${msg}`, err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((url, options) => request(url, 'GET', null, options), [request]);
    const post = useCallback((url, body, options) => request(url, 'POST', body, options), [request]);
    const put = useCallback((url, body, options) => request(url, 'PUT', body, options), [request]);
    const del = useCallback((url, options) => request(url, 'DELETE', null, options), [request]);

    return {
        loading,
        error,
        get,
        post,
        put,
        del,
        request
    };
}