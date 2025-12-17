import {useCallback, useState} from 'react';
import useApi from "../useApi";
import {tokenStorage} from "../../utils/tokenStorage";

export default function useUserSetting() {
    const {loading, error, get, post, put, del} = useApi();
    const [currentUser, setCurrentUser] = useState(null);

    // 登录接口
    const login = useCallback(async (username, password) => {
        const result = await post('/api/user_setting/login', {
            username,
            password
        });

        if (result && result.access_token) {
            // 存储 Token
            tokenStorage.setTokens(result.access_token, result.refresh_token);
            // localStorage.setItem('access_token', result.access_token);
            // localStorage.setItem('refresh_token', result.refresh_token);
            return result;
        }
        return null;
    }, [post]);

    // 获取用户信息
    const fetchUserProfile = useCallback(async () => {
        const result = await get('/api/user_setting/user');
        setCurrentUser(result);
        return result;
    }, [get]);

    // 登出
    const logout = useCallback(() => {
        // localStorage.removeItem('access_token');
        // localStorage.removeItem('refresh_token');
        tokenStorage.clearTokens();
        setCurrentUser(null);
        post('/api/user/logout');
    }, []);

    // 注册接口
    const register = useCallback(async (username, password) => {
        const result = await post('/api/user_setting/register', {
            username,
            password
        });
        if (result && result.access_token) {
            // localStorage.setItem('access_token', result.access_token);
            // localStorage.setItem('refresh_token', result.refresh_token);
            tokenStorage.setTokens(result.access_token, result.refresh_token);
            return result;
        }
        return null;
    }, [post]);

    // 更新用户设置
    const updateUser = useCallback(async (userData) => {
        const result = await put('/api/user_setting/user', userData);
        if (result) {
            setCurrentUser(prev => ({...prev, ...result}));
        }
        return result;
    }, [put]);

    // 修改密码
    const changePassword = useCallback(async (oldPassword, newPassword) => {
        const result = await post('/api/user_setting/pwd', {
            old_password: oldPassword,
            new_password: newPassword
        });
        if (result && result.access_token && result.refresh_token) {
            tokenStorage.setTokens(result.access_token, result.refresh_token);
        }
        return result;
    }, [post]);

    return {
        loading,
        error,
        login,
        logout,
        fetchUserProfile,
        currentUser,
        register,
        updateUser,
        changePassword
    };
}