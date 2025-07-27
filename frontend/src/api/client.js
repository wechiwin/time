import axios from 'axios';

const apiClient = axios.create({
    // baseURL: '/api', // 根据你的实际API地址配置
    timeout: 10000,
});

// 统一响应处理
apiClient.interceptors.response.use(
    (response) => {
        const res = response.data;
        // 判断业务状态码
        if (res.code !== 0) {
            return Promise.reject(new Error(res.message || 'Error'));
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