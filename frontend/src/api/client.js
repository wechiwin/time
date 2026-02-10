import axios from 'axios';
import i18n from '../i18n/i18n';
import SecureTokenStorage from "../utils/tokenStorage";
import {toastInstance} from "../utils/toastInstance";

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    withCredentials: true, // 携带 Cookie
    headers: {
        'X-Requested-With': 'XMLHttpRequest'
    }
});

// 请求拦截器
apiClient.interceptors.request.use(config => {
    if (config._skipAuth) {
        return config;
    }
    // 注入Access Token
    const token = SecureTokenStorage.getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // 将当前的 i18next 语言设置到 Header 中
    config.headers['Accept-Language'] = i18n.language;
    return config;
}, (error) => {
    return Promise.reject(error);
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

export const AUTH_EXPIRED_EVENT = 'auth:session-expired';
export const AUTH_TOKEN_REFRESHED = 'auth:token-refreshed';

// 在响应拦截器中处理 401
apiClient.interceptors.response.use(
    response => {
        // 如果是下载文件(blob)，直接返回整个 response 对象，不进行 code 校验
        if (response.config?.responseType === 'blob') return response;
        return response;
    },
    async error => {
        const originalRequest = error.config;

        // 如果是刷新请求本身失败，直接抛出
        if (originalRequest.url.includes('/user_setting/refresh')) {
            return Promise.reject(error);
        }

        // 如果是网络错误，直接提示
        if (!error.response) {
            toastInstance.showErrorToast(i18n.t('errors_request_failed'));
            return Promise.reject(new Error('Network error'));
        }

        const {status} = error.response;

        // 处理 401：尝试刷新 Token
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url.endsWith('/login') &&
            !originalRequest.url.endsWith('/refresh')
        ) {
            if (isRefreshing) {
                // 正在刷新，加入队列等待
                return new Promise((resolve, reject) => {
                    failedQueue.push({resolve, reject});
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true; // 防止无限循环
            isRefreshing = true;

            try {
                const response = await apiClient.post('/user_setting/refresh', {}, {
                    withCredentials: true,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept-Language': i18n.language
                    },
                    _skipAuth: true
                });

                const newAccessToken = response.data.data.access_token;
                SecureTokenStorage.setAccessToken(newAccessToken);

                // 通知 AuthContext 更新状态
                window.dispatchEvent(new CustomEvent(AUTH_TOKEN_REFRESHED, {
                    detail: {token: newAccessToken}
                }));

                processQueue(null, newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
                SecureTokenStorage.clearTokens();
                processQueue(refreshError, null);

                // 统一触发登出事件
                window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
                return Promise.reject(new Error('会话已过期，请重新登录'));
            } finally {
                isRefreshing = false;
            }
        }

        // 其他错误按原逻辑处理
        if (status >= 500) {
            const msg = error.response.data?.msg || i18n.t('errors_server_error');
            return Promise.reject(new Error(msg));
        }
        const msg = error.response.data?.msg || i18n.t('errors_request_failed', { status });
        return Promise.reject(new Error(msg));
    }
);


export default apiClient;