import {useCallback, useState} from 'react';
import useApi from "../useApi";
import SecureTokenStorage from "../../utils/tokenStorage";

export default function useUserSetting() {
    const {loading, error, get, post, put, del} = useApi();
    const [currentUser, setCurrentUser] = useState(null);

    const urlPrefix = '/user_setting';

    // 登录接口
    const login = useCallback(async (username, password) => {
        const result = await post(urlPrefix + '/login', {
            username,
            password
        }, {});
        console.log(result)
        if (result?.access_token) {
            // 存储Token（CSRF从header获取）
            SecureTokenStorage.setAccessToken(result.access_token)
            console.log(SecureTokenStorage.toString())
            return result;
        }
        return null;
    }, [post]);

    // 获取用户信息
    const fetchUserProfile = useCallback(async () => {
        const result = await get(urlPrefix + '/user', {});
        setCurrentUser(result);
        return result;
    }, [get]);

    // 登出
    const logout = useCallback(async () => {
        try {
            // 必须POST到正确路径，withCredentials自动携带cookie
            await post(urlPrefix + '/logout', {}, {
                withCredentials: true,
                headers: {
                    'X-CSRF-Token': SecureTokenStorage.getCsrfToken() || '',
                }
            });
        } catch (err) {
            console.warn("Logout API failed:", err);
        } finally {
            // 无论API是否成功，都清除本地token
            SecureTokenStorage.clearTokens();
            setCurrentUser(null);
        }
    }, [post]);

    // 注册接口
    const register = useCallback(async (username, password) => {
        const result = await post(urlPrefix + '/register', {
            username,
            password
        }, {});
        if (result?.access_token) {
            // 注册成功后自动登录，存储token
            SecureTokenStorage.setAccessToken(result.access_token)
            return result;
        }
        return null;
    }, [post]);

    // 更新用户设置
    const updateUser = useCallback(async (userData) => {
        const result = await put(urlPrefix + '/user', userData, {});
        if (result) {
            setCurrentUser(prev => ({...prev, ...result}));
        }
        return result;
    }, [put]);

    // 修改密码
    const changePassword = useCallback(async (oldPassword, newPassword) => {
        const result = await post(urlPrefix + '/pwd', {
            old_password: oldPassword,
            new_password: newPassword
        }, {});
        if (result?.access_token) {
            SecureTokenStorage.setAccessToken(result.access_token)
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