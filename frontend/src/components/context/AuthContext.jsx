// src/contexts/AuthContext.jsx
import React, {createContext, useCallback, useEffect, useState} from 'react';
import SecureTokenStorage from "../../utils/tokenStorage";
import useApi from "../../hooks/useApi";
import {AUTH_TOKEN_REFRESHED} from "../../api/client";
import useTokenManager from "../../hooks/api/useTokenManager";

export const AuthContext = createContext();

/**
 * AuthProvider 组件
 * @description 为整个应用提供认证状态 (isAuthenticated)、用户信息 (user) 和加载状态 (isLoading)。
 * 它还提供了更新这些状态的方法，供应用的其他部分（如 useUserSetting hook）使用。
 */
export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // 初始为 true，表示正在检查认证状态
    const { get } = useApi();
    useTokenManager();
    /**
     * 检查认证状态 (通常在应用加载时调用)
     * @description 验证本地存储的 Token 是否有效，如果有效，则获取用户信息。
     */
    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true);
        const token = SecureTokenStorage.getAccessToken();
        if (!token) {
            setIsAuthenticated(false);
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const userData = await get('/user_setting/user', {});
            setIsAuthenticated(true);
            setUser(userData);
        } catch (error) {
            // 如果获取失败，说明 token 无效或已过期
            console.warn("Auth check failed, token might be invalid:", error.message);
            SecureTokenStorage.clearTokens();
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [get]);

    /**
     * 设置认证状态 (用于登录/注册成功后)
     * @description 这是一个高效的更新函数，避免了登录后再发请求验证的冗余步骤。
     * @param {object} userData - 从登录/注册 API 返回的用户对象。
     * @param {string} token - 从登录/注册 API 返回的 access_token。
     */
    const setAuthState = useCallback((userData, token) => {
        SecureTokenStorage.setAccessToken(token);
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false); // 确保加载状态结束
    }, []);

    /**
     * 清除认证状态 (用于登出)
     * @description 统一处理登出时的状态清理和本地存储清理。
     */
    const clearAuthState = useCallback(() => {
        SecureTokenStorage.clearTokens();
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    // 应用首次加载时，执行一次认证状态检查
    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    // AuthProvider.jsx - 新增 useEffect 监听 token 刷新
    useEffect(() => {
        const handleTokenRefreshed = (event) => {
            const { token } = event.detail;
            // 重新获取用户信息（可选，如果 token payload 不包含足够信息）
            get('/user_setting/user', {}).then(userData => {
                setUser(userData);
                setIsAuthenticated(true);
            }).catch(err => {
                console.warn("Token refreshed but user fetch failed:", err);
                clearAuthState();
                window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
            });
        };

        window.addEventListener(AUTH_TOKEN_REFRESHED, handleTokenRefreshed);
        return () => window.removeEventListener(AUTH_TOKEN_REFRESHED, handleTokenRefreshed);
    }, [get, clearAuthState]);


    const value = {
        isAuthenticated,
        user,
        isLoading,
        checkAuthStatus,
        setAuthState,
        clearAuthState,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
