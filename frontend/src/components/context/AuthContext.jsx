// src/contexts/AuthContext.jsx
import React, {createContext, useCallback, useEffect, useState} from 'react';
import SecureTokenStorage from "../../utils/tokenStorage";
import useApi from "../../hooks/useApi";

export const AuthContext = createContext();

export function AuthProvider({children}) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // 初始为 true，表示正在检查认证状态
    const { get } = useApi();

    // 检查认证状态的函数
    const checkAuthStatus = useCallback(async () => {
        const token = SecureTokenStorage.getAccessToken();
        if (!token) {
            setIsAuthenticated(false);
            setIsLoading(false);
            return;
        }

        try {
            // 尝试用现有 token 获取用户信息
            await get('/user_setting/user', {});
            // 如果请求成功（没有抛出错误），说明 Token 有效
            setIsAuthenticated(true);
        } catch (error) {
            // 如果获取失败，说明 token 无效，清除它
            console.log("Initial auth check failed, token is invalid.");
            SecureTokenStorage.clearTokens();
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, [get]);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    const value = {
        isAuthenticated,
        isLoading,
        checkAuthStatus, // 暴露出去，以便登录后可以手动调用
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
