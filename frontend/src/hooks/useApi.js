import {useCallback, useEffect, useState} from 'react';
import apiClient from '../api/client.js';

export default function useApi(endpoint) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
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
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // GET 请求
    const get = useCallback(async (url = endpoint) => {
        const result = await request(url);
        setData(result || []);
        return result;
    }, [endpoint, request]);

    // POST 请求
    const post = useCallback(async (url = endpoint, body) => {
        const result = await request(url, 'POST', body);
        setData(prev => Array.isArray(prev) ? [...prev, result] : result);
        return result;
    }, [endpoint, request]);

    // PUT 请求
    const put = useCallback(async (url = endpoint, body) => {
        const result = await request(url, 'PUT', body);
        setData(result);
        return result;
    }, [endpoint, request]);

    // DELETE 请求
    const del = useCallback(async (url = endpoint) => {
        const result = await request(url, 'DELETE');
        // 更安全的处理方式
        if (result && result.id) {
            setData(prev => Array.isArray(prev) ? prev.filter(item => item.id !== result.id) : null);
        } else {
            // 如果没有返回ID，直接重新获取数据
            await get();
        }
        return result;
    }, [endpoint, request, get]);

    // 初始化获取数据
    useEffect(() => {
        if (endpoint) get();
    }, [endpoint, get]);

    return {
        data,
        loading,
        error,
        get,
        post,
        put,
        del,
        request, // 原始请求方法
        refetch: () => get(endpoint) // 兼容旧版
    };
}