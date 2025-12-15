import axios from 'axios';
import i18n from '../i18n/i18n';

const apiClient = axios.create({
    // baseURL: '/api', // 根据你的实际API地址配置
    timeout: 10000,
});

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
    (error) => {
        // 网络错误或超时
        if (!error.response) {
            return Promise.reject(new Error('网络连接失败，请检查网络'));
        }
        const {status, data} = error.response;

        // 401 未授权
        if (status === 401) {
            console.error('Session expired or unauthorized');
            localStorage.removeItem('access_token');
            window.location.replace('/login');
            return Promise.reject(new Error('Unauthorized: Session expired.'));
        }

        // 500 系统错误
        if (status >= 500) {
            const msg = data?.msg || data?.message || '服务器内部错误';
            const traceId = data?.data?.trace_id;
            const errorMsg = traceId ? `${msg} (TraceID: ${traceId})` : msg;
            return Promise.reject(new Error(errorMsg));
        }

        // 其他HTTP错误
        const msg = data?.msg || data?.message || `请求失败 (HTTP ${status})`;
        return Promise.reject(new Error(msg));
    }
);

export default apiClient;