import axios from 'axios';
import i18n from '../i18n/i18n';
import SecureTokenStorage from "../utils/tokenStorage";

const apiClient = axios.create({
    baseURL: '/api',
    timeout: 10000,
    withCredentials: true, // 携带 Cookie
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
    // 注入Access Token
    const token = SecureTokenStorage.getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // 注入CSRF Token
    const csrfToken = SecureTokenStorage.getCsrfToken();
    if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
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
        // 自动保存CSRF Token（如果后端返回）
        const newCsrfToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
        // console.log('CSRF Token extracted:', newCsrfToken);
        if (newCsrfToken) {
            SecureTokenStorage.setCsrfToken(newCsrfToken)
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

        return res;
    },
    async (error) => {
        const originalRequest = error.config;
        // 网络错误
        if (!error.response) {
            return Promise.reject(new Error('网络连接失败，请检查网络'));
        }
        const {status, data} = error.response;
        // 401处理 - Token刷新逻辑
        if (status === 401 && !originalRequest._retry && originalRequest.url !== '/api/user_setting/refresh') {
            if (isRefreshing) {
                // 加入队列等待刷新完成
                return new Promise((resolve, reject) => {
                    failedQueue.push({resolve, reject});
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
                const csrfToken = SecureTokenStorage.getCsrfToken();
                // 调用刷新接口（refresh_token自动通过cookie发送）
                const response = await axios.post('/api/user_setting/refresh', {}, {
                    withCredentials: true,
                    headers: {
                        'X-CSRF-Token': csrfToken || '',
                        'Accept-Language': i18n.language
                    }
                });
                const {access_token} = response.data;
                const newCsrfToken = response.headers['X-CSRF-Token'] || response.headers['X-CSRF-Token'];

                // 存储新token
                SecureTokenStorage.setAccessToken(access_token);
                SecureTokenStorage.setCsrfToken(newCsrfToken);

                // 处理队列中的请求
                processQueue(null, access_token);
                isRefreshing = false;

                // 重试原始请求
                originalRequest.headers.Authorization = `Bearer ${access_token}`;
                originalRequest.headers['X-CSRF-Token'] = newCsrfToken;
                return apiClient(originalRequest);
            } catch (refreshError) {
                // 刷新失败，清除token并跳转登录
                processQueue(refreshError, null);
                isRefreshing = false;
                SecureTokenStorage.clearTokens();
                // 跳转到登录页
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                return Promise.reject(new Error('会话已过期，请重新登录'));
            }
        }
        // 其他401错误（刷新token失败）
        if (status === 401 && originalRequest.url === '/api/user_setting/refresh') {
            SecureTokenStorage.clearTokens();
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
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