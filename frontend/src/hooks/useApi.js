import {useCallback, useState} from 'react';
import apiClient from '../api/client.js';

// 定义一个全局事件名
export const AUTH_EXPIRED_EVENT = 'auth:session-expired';

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
            // 对登录认证的错误拦截并挂起，防止错误传递给其他组件
            if (err.isSessionExpired) {
                console.warn('[useApi] 会话过期，拦截错误并触发跳转');

                // 1. 触发全局事件通知 App.jsx 进行跳转
                window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));

                // 2. 返回一个永远不 Resolve 也不 Reject 的 Promise
                // 这会让调用组件 (HoldingPage) 的 await 永远等待
                // 从而阻止代码进入组件的 catch 块
                return new Promise(() => {});
            }

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

    return {
        loading,
        error,
        get,
        post,
        put,
        del,
        download,
        request
    };
}