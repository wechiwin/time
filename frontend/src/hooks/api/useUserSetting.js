import {useCallback, useContext, useState} from 'react';
import useApi from "../useApi";
import SecureTokenStorage from "../../utils/tokenStorage";
import {AuthContext} from "../../components/context/AuthContext";

export default function useUserSetting() {
    const {loading, error, get, post, put} = useApi();
    const {setAuthState, clearAuthState, user: currentUser} = useContext(AuthContext);
    const urlPrefix = '/user_setting';

    // 登录接口
    const login = useCallback(async (username, password) => {
        const result = await post(urlPrefix + '/login', {username, password}, {});
        if (result?.access_token && result?.user) {
            // 直接使用登录返回的数据更新全局状态
            setAuthState(result.user, result.access_token);
            return result;
        }
        return null;
    }, [post, setAuthState]);

    // 获取用户信息
    const fetchUserProfile = useCallback(async () => {
        const result = await get(urlPrefix + '/user', {});
        // 这里可以考虑是否还需要本地 state，或者直接依赖 AuthContext 的 user
        // 如果 AuthContext 的 user 已经够用，这个函数可能只需要返回 result
        return result;
    }, [get]);

    // 登出
    const logout = useCallback(async () => {
        try {
            // 必须POST到正确路径，withCredentials自动携带cookie
            await post(urlPrefix + '/logout', {}, {
                withCredentials: true,
                headers: {}
            });
        } catch (err) {
            console.warn("Logout API failed:", err);
        } finally {
            // 无论API是否成功，都调用 context 的方法来清理状态
            clearAuthState();
        }
    }, [post, clearAuthState]);

    // 注册接口
    const register = useCallback(async (username, password) => {
        const result = await post(urlPrefix + '/register', {username, password}, {});
        if (result?.access_token && result?.user) {
            // 注册成功后也直接更新全局状态
            setAuthState(result.user, result.access_token);
            return result;
        }
        return null;
    }, [post, setAuthState]);

    // 更新用户设置
    const updateUser = useCallback(async (userData) => {
        const result = await post(urlPrefix + '/update_user', userData);
        return result;
    }, [post]);

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