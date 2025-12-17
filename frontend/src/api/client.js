import axios from 'axios';
import i18n from '../i18n/i18n';
import {tokenStorage} from "../utils/tokenStorage";

const apiClient = axios.create({
    // baseURL: '/api', // 根据你的实际API地址配置
    timeout: 10000,
});
// Token刷新队列管理
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
// 请求拦截器
apiClient.interceptors.request.use(config => {
    // 注入 Token
    const token = localStorage.getItem('access_token');
    if (token) {
        // 使用 JWT 认证的标准格式：Bearer Token
        config.headers.Authorization = `Bearer ${token}`;
    }

    // 将当前的 i18next 语言设置到 Header 中
    config.headers['Accept-Language'] = i18n.language;
    // console.log('Accept-Language in Interceptor:', config.headers['Accept-Language']);
    return config;
}, (error) => {
    return Promise.reject(error);
});

// 统一响应处理
apiClient.interceptors.response.use(
    (response) => {
        // 如果是下载文件(blob)，直接返回整个 response 对象，不进行 code 校验
        if (response.config.responseType === 'blob') {
            return response;
        }

        const res = response.data;
        // 情况1：HTTP 200 + 业务码200 → 成功
        if (response.status === 200 && res.code === 200) {
            return res.data;
        }

        // 情况2：HTTP 200 + 业务码非200 → 业务异常
        if (response.status === 200 && res.code !== 200) {
            const msg = res.msg || res.message || `业务错误: code=${res.code}`;
            return Promise.reject(new Error(msg));
        }

        // 情况3：HTTP 4xx/5xx → 系统异常
        if (response.status >= 400) {
            const msg = res.msg || res.message || `请求失败: HTTP ${response.status}`;
            return Promise.reject(new Error(msg));
        }

        // 其他情况（兼容旧格式）
        return res;
    },
    async (error) => {
        const originalRequest = error.config;
        // 网络错误
        if (!error.response) {
            return Promise.reject(new Error('网络连接失败，请检查网络'));
        }
        const { status, data } = error.response;
        // 401处理 - Token刷新逻辑
        if (status === 401 && !originalRequest._retry && originalRequest.url !== '/api/user/refresh') {
            if (isRefreshing) {
                // 加入队列等待刷新完成
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }
            originalRequest._retry = true;
            isRefreshing = true;
            try {
                const refreshToken = tokenStorage.getRefreshToken();
                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }
                // 调用刷新接口
                const response = await axios.post('/api/user/refresh', {}, {
                    headers: {
                        Authorization: `Bearer ${refreshToken}`
                    }
                });
                const newAccessToken = response.data.access_token;
                tokenStorage.setAccessToken(newAccessToken);
                // 处理队列中的请求
                processQueue(null, newAccessToken);
                isRefreshing = false;
                // 重试原始请求
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                // 刷新失败，清除token并跳转登录
                processQueue(refreshError, null);
                isRefreshing = false;
                tokenStorage.clearTokens();
                window.location.href = '/login';
                return Promise.reject(new Error('会话已过期，请重新登录'));
            }
        }
        // 其他401错误（刷新token失败）
        if (status === 401) {
            tokenStorage.clearTokens();
            window.location.href = '/login';
            return Promise.reject(new Error('会话已过期，请重新登录'));
        }
        // 500错误
        if (status >= 500) {
            const msg = data?.msg || data?.message || '服务器内部错误';
            const traceId = data?.data?.trace_id;
            const errorMsg = traceId ? `${msg} (TraceID: ${traceId})` : msg;
            return Promise.reject(new Error(errorMsg));
        }
        // 其他错误
        const msg = data?.msg || data?.message || `请求失败 (HTTP ${status})`;
        return Promise.reject(new Error(msg));
    }
);
export default apiClient;