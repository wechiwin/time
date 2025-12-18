import {useCallback, useState} from 'react';
import useApi from "../useApi";
import SecureTokenStorage from "../../utils/tokenStorage";

export default function useUserSetting() {
    const {loading, error, get, post, put, del} = useApi();
    const [currentUser, setCurrentUser] = useState(null);

    // 登录接口
    const login = useCallback(async (username, password) => {
        const result = await post('/user_setting/login', {
            username,
            password
        });

        if (result && result.data.access_token) {
            // 存储 Token
            SecureTokenStorage.setTokens(
                result.data.access_token,
                result.data.csrf_token);
            return result;
        }
        return null;
    }, [post]);

    // 获取用户信息
    const fetchUserProfile = useCallback(async () => {
        const result = await get('/user_setting/user');
        setCurrentUser(result);
        return result;
    }, [get]);

    // 登出
    const logout = useCallback(() => {
        SecureTokenStorage.clearTokens();
        setCurrentUser(null);
        post('/user/logout');
    }, []);

    // 注册接口
    const register = useCallback(async (username, password) => {
        const result = await post('/user_setting/register', {
            username,
            password
        });
        if (result && result.data.access_token) {
            SecureTokenStorage.setTokens(
                result.data.access_token,
                result.data.csrf_token);
            return result;
        }
        return null;
    }, [post]);

    // 更新用户设置
    const updateUser = useCallback(async (userData) => {
        const result = await put('/user_setting/user', userData);
        if (result) {
            setCurrentUser(prev => ({...prev, ...result}));
        }
        return result;
    }, [put]);

    // 修改密码
    const changePassword = useCallback(async (oldPassword, newPassword) => {
        const result = await post('/user_setting/pwd', {
            old_password: oldPassword,
            new_password: newPassword
        });
        if (result && result.data.access_token && result.data.refresh_token) {
            SecureTokenStorage.setTokens(
                result.data.access_token,
                result.data.csrf_token);
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