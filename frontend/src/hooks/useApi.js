import {useCallback, useState} from 'react';
import apiClient from '../api/client.js';

export default function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 通用请求方法
    const request = useCallback(async (url, method = 'GET', body = null, config = {}) => {
        try {
            setLoading(true);
            setError(null);

            let response;
            switch (method) {
                case 'GET':
                    response = await apiClient.get(url, config);
                    break;
                case 'POST':
                    response = await apiClient.post(url, body, config);
                    break;
                case 'PUT':
                    response = await apiClient.put(url, body, config);
                    break;
                case 'DELETE':
                    response = await apiClient.delete(url, config);
                    break;
                default:
                    throw new Error(`Unsupported method: ${method}`);
            }
            // 如果是文件下载（blob），返回整个 response
            if (config.responseType === 'blob') {
                return response;
            }
            // 普通请求返回 data.data
            return response.data.data;
        } catch (err) {

            const msg = err.message || '请求失败';
            setError(msg);
            console.error(`[useApi] 请求错误: ${msg}`, err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((url, options = {}) => request(url, 'GET', null, options), [request]);
    const post = useCallback((url, body, options = {}) => request(url, 'POST', body, options), [request]);
    const put = useCallback((url, body, options = {}) => request(url, 'PUT', body, options), [request]);
    const del = useCallback((url, options = {}) => request(url, 'DELETE', null, options), [request]);

    // 专门的文件下载方法
    const download = useCallback(async (url, filename, config = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get(url, {
                ...config,
                responseType: 'blob'
            });
            // 处理 Blob 下载
            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            return response;
        } catch (err) {
            const msg = err.message || '下载失败';
            setError(msg);
            console.error(`[useApi] 下载错误: ${msg}`, err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // POST 方式下载文件
    const downloadPost = useCallback(async (url, body, filename, config = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.post(url, body, {
                ...config,
                responseType: 'blob'
            });
            // 处理 Blob 下载
            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            return response;
        } catch (err) {
            const msg = err.message || '下载失败';
            setError(msg);
            console.error(`[useApi] 下载错误: ${msg}`, err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        get,
        post,
        put,
        del,
        download,
        downloadPost,
        request
    };
}