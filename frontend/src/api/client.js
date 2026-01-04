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
    // 注入CSRF Token
    const csrfToken = SecureTokenStorage.getCsrfToken();
    if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
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
        const oldCsrfToken = SecureTokenStorage.getCsrfToken();
        // console.log("refreshAuthLogic - oldCsrfToken", oldCsrfToken)
        // 调用刷新接口
        const response = await apiClient.post('/user_setting/refresh', {}, {
            withCredentials: true,
            headers: {
                'X-CSRF-Token': oldCsrfToken || '',
                'Accept-Language': i18n.language
            },
            _skipAuth: true
        });

        console.log("refreshAuthLogic - response", response)
        // 存储新token
        const newAccessToken = response.data.data.access_token;
        // console.log("refreshAuthLogic - newAccessToken", newAccessToken)
        SecureTokenStorage.setAccessToken(newAccessToken);

        const newCsrfToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'] || response.headers['X-Csrf-Token'];
        // console.log("refreshAuthLogic - newCsrfToken", newCsrfToken)
        if (newCsrfToken) {
            SecureTokenStorage.setCsrfToken(newCsrfToken);
        }

        // 更新失败请求的 headers
        failedRequest.response.config.headers.Authorization = `Bearer ${newAccessToken}`;
        if (newCsrfToken) {
            failedRequest.response.config.headers['X-CSRF-Token'] = newCsrfToken;
        }

        return Promise.resolve();
    } catch (refreshError) {
        console.log(refreshError)
        // 刷新失败，清除token并跳转登录
        SecureTokenStorage.clearTokens();
        console.log("refreshAuthLogic - clearTokens")
        // 跳转到登录页
        // if (typeof window !== 'undefined') {
        //     window.location.href = '/login';
        // }
        return Promise.reject(new Error('会话已过期，请重新登录'));
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
        // console.log("interceptors.response - response", response)
        // 如果是下载文件(blob)，直接返回整个 response 对象，不进行 code 校验
        if (response.config?.responseType === 'blob') {
            return response;
        }
        if (response.config?._skipAuth && response.config.url !== '/api/user_setting/refresh') {
            // console.log("refresh 接口的response 跳过 interceptors response")
            return response;
        }
        // 自动保存CSRF Token（如果后端返回）
        const headers = response.headers || {};
        const newCsrfToken = headers['x-csrf-token'] || headers['X-CSRF-Token'] || headers['X-Csrf-Token'];
        // console.log('interceptors.response - newCsrfToken', newCsrfToken);
        if (newCsrfToken) {
            SecureTokenStorage.setCsrfToken(newCsrfToken)
        }
        // const resData = response.data.data;
        // return resData;
        return response;
    },
    // 错误处理
    async (error) => {
        const {response, config} = error;
        if (!response) {
            // 网络错误
            toastInstance.showErrorToast('网络连接失败，请检查网络');
            return Promise.reject(new Error('网络连接失败，请检查网络'));
        }
        const {status, data} = response;
        // // 401处理 - Token刷新逻辑
        // if (status === 401 && !config._retry && config.url !== '/api/user_setting/refresh') {
        //     console.log("检测到401错误，尝试刷新Token...");
        //     return handleTokenRefresh(config);
        // }
        // 刷新接口本身报 401，说明 Refresh Token 也过期了
        if (status === 401 && config.url === '/api/user_setting/refresh') {
            console.log("刷新接口报错401，Refresh Token 过期");
            SecureTokenStorage.clearTokens();
            console.log("clearTokens in error")
            // if (typeof window !== 'undefined') {
            //     window.location.href = '/login';
            // }
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