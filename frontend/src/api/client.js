import axios from 'axios';
import i18n from '../i18n/i18n';

const apiClient = axios.create({
    // baseURL: '/api', // 根据你的实际API地址配置
    timeout: 10000,
});

// 请求拦截器
apiClient.interceptors.request.use(config => {
    // 将当前的 i18next 语言设置到 Header 中
    config.headers['Accept-Language'] = i18n.language;
    console.log('Accept-Language in Interceptor:', config.headers['Accept-Language']);
    return config;
});

// 统一响应处理
apiClient.interceptors.response.use(
    (response) => {
        // [新增修复] 关键代码：如果是下载文件(blob)，直接返回整个 response 对象，不进行 code 校验
        if (response.config.responseType === 'blob') {
            return response;
        }

        const res = response.data;
        // 判断业务状态码
        if (res.code !== 200) {
            const msg = res.message && res.message.trim() ? res.message : `请求失败，code=${res.code}`;
            return Promise.reject(new Error(msg));
        }
        // console.log('clientjs')
        return res.data; // 直接返回data字段的数据
    },
    (error) => {
        // 处理HTTP错误
        return Promise.reject(error);
    }
);

export default apiClient;