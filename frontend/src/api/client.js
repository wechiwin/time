import axios from 'axios';
import i18n from '../i18n/i18n';
import SecureTokenStorage from "../utils/tokenStorage";
import {toastInstance} from "../utils/toastInstance";
import createAuthRefreshInterceptor from "axios-auth-refresh";

const apiClient = axios.create({
    baseURL: '/api',
    timeout: 10000,
    withCredentials: true, // 携带 Cookie
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


/**
 * 核心逻辑：处理 Token 刷新和重试
 * 提取出来供 HTTP 401
 */
const refreshAuthLogic = async (failedRequest) => {
    try {
        const response = await apiClient.post('/user_setting/refresh', {}, {
            withCredentials: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept-Language': i18n.language
            },
            _skipAuth: true
        });

        console.log("refreshAuthLogic - response", response)
        // 存储新token
        const newAccessToken = response.data.data.access_token;
        SecureTokenStorage.setAccessToken(newAccessToken);

        // 更新失败请求的 headers
        failedRequest.response.config.headers.Authorization = `Bearer ${newAccessToken}`;

        return Promise.resolve();
    } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        SecureTokenStorage.clearTokens();
        // 抛出一个带有特定标记的错误，避免被响应拦截器误判为网络错误
        const error = new Error('会话已过期，请重新登录');
        error.isSessionExpired = true;
        return Promise.reject(error);
    }
};
// 设置 token 刷新拦截器
createAuthRefreshInterceptor(apiClient, refreshAuthLogic, {
    statusCodes: [401],  // 只在 401 时触发刷新
    pauseInstanceWhileRefreshing: true,  // 刷新时暂停其他请求
    retryInstance: apiClient,  // 使用同一个实例重试
    shouldRefresh: (error) => {
        // 排除刷新接口本身的 401 错误
        const config = error.config;
        const status = error.response?.status;
        return status === 401 &&
            !config._skipAuth &&
            config.url !== '/api/user_setting/refresh';
    }
});


// 统一响应处理
apiClient.interceptors.response.use(
    (response) => {
        // 如果是下载文件(blob)，直接返回整个 response 对象，不进行 code 校验
        if (response.config?.responseType === 'blob') {
            return response;
        }
        return response;
    },
    // 错误处理
    async (error) => {
        // 1. 优先处理我们手动抛出的“会话过期”错误
        if (error.isSessionExpired) {
            // 这里可以选择是否跳转，或者让上层组件处理
            // if (typeof window !== 'undefined') window.location.href = '/login';
            return Promise.reject(error);
        }

        const {response} = error;

        // 2. 处理真正的网络错误（没有 response 对象）
        if (!response) {
            // 过滤掉因为刷新逻辑抛出的非 Axios 错误
            if (error.message && (error.message.includes('会话'))) {
                return Promise.reject(error);
            }
            toastInstance.showErrorToast('网络连接失败，请检查网络');
            return Promise.reject(new Error('网络连接失败，请检查网络'));
        }
        const {status, data} = response;

        // 3. 处理刷新接口本身的 401/400 错误
        if ((status === 401 || status === 400) && error.config.url.includes('/user_setting/refresh')) {
            const sessionErr = new Error('会话已过期');
            sessionErr.isSessionExpired = true;
            return Promise.reject(sessionErr);
        }

        // 4. 其他错误
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