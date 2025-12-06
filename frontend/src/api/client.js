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
    console.log('Accept-Language in Interceptor:', config.headers['Accept-Language']);
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
        // 判断业务状态码
        if (res.code !== 200) {
            const msg = res.message && res.message.trim() ? res.message : `请求失败，code=${res.code}`;
            return Promise.reject(new Error(msg));
        }
        // console.log('clientjs')
        return res.data; // 直接返回data字段的数据
    },
    (error) => {
        // 处理 401 Unauthorized 错误
        if (error.response && error.response.status === 401) {
            console.error('Session expired or unauthorized. Clearing token and redirecting.');

            // 1. 清除失效的 Token
            localStorage.removeItem('access_token');

            // 2. 跳转到登录页
            // 由于这里是 JS 模块，不是 React 组件，使用硬跳转 (replace) 更可靠。
            // 导入 useNavigate 的替代品：因为拦截器不是 React 组件，不能使用 Hook。
            // 我们需要一个可以执行路由跳转的函数。
            // 常见的做法是单独维护一个 history/navigate 对象。
            // ⚠️ 假设你已经设置了一个名为 'history' 的模块来管理路由状态，例如：
            // import { history } from '../router/history';
            // 如果你的 React Router 是 V6，通常需要传递 navigate 函数或使用 window.location。
            // 为了简化，这里先使用 window.location.replace() 进行硬跳转。
            // 如果你想使用 V6 的 navigate，请告诉我你如何访问它。
            window.location.replace('/login');

            // 阻止 Promise 链继续执行，防止组件继续处理 401 错误
            return Promise.reject(new Error('Unauthorized: Session expired.'));
        }
        return Promise.reject(error);
    }
);

export default apiClient;