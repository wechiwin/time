// src/hooks/useTokenManager.js
import {useEffect, useRef} from 'react';
import SecureTokenStorage from "../utils/tokenStorage";
import {isTokenExpiringSoon} from "../utils/jwtUtils";
import {now} from "../utils/timeUtil";
import apiClient from "../api/client";

/**
 * useTokenManager - 专职管理 Access Token 的生命周期
 * 功能：
 *  1. 启动定时器，定期检查 Token 是否即将过期
 *  2. 若即将过期（默认 <60s），则静默调用 /refresh 接口刷新
 *  3. 自动清理定时器，避免内存泄漏
 *  4. 增加并发锁，防止 React StrictMode 或网络延迟导致的双重刷新
 * 使用方式：
 *   在 AuthProvider 或 App 组件中调用即可，无需消费返回值。
 */
export default function useTokenManager() {
    const refreshTimerRef = useRef(null);
    // 使用 ref 作为并发锁，因为它在渲染间保持持久且不触发重渲染
    const isRefreshingRef = useRef(false);

    /**
     * 执行一次 Token 预刷新检查
     */
    const checkAndRefreshToken = async () => {
        // 1. 并发锁检查：如果正在刷新，直接跳过
        if (isRefreshingRef.current) {
            console.debug('[TokenManager] 刷新正在进行中，跳过本次请求', now());
            return;
        }

        const token = SecureTokenStorage.getAccessToken();
        if (!token) {
            console.warn('[TokenManager] No token available, skipping proactive refresh.', now());
            return;
        }

        // 检查是否即将过期（提前 60 秒触发）
        if (!isTokenExpiringSoon(token, 60)) {
            console.debug('[TokenManager] Token 仍有效，无需刷新', now());
            return;
        }

        try {
            // 2. 加锁
            isRefreshingRef.current = true;
            console.log('[TokenManager] Token expiring soon, initiating proactive refresh...', now());

            const response = await apiClient.post('/user_setting/refresh', {}, {
                _skipAuth: true // 同样跳过 Access Token 注入
            });

            const newAccessToken = response.data?.data?.access_token;
            if (newAccessToken) {
                SecureTokenStorage.setAccessToken(newAccessToken);
                console.log('[TokenManager] Proactive token refresh successful.', now());
                window.dispatchEvent(new CustomEvent('AUTH_TOKEN_REFRESHED', { detail: { token: newAccessToken } }));
            } else {
                // 这种情况通常意味着后端成功响应了 200，但返回的数据格式不符合预期
                console.warn('[TokenManager] Refresh endpoint returned success but no new token was found in the response.', now());
            }
        } catch (err) {
            // 不抛错，不影响主流程。被动刷新机制仍是后备方案。
            // axios 在遇到非 2xx 状态码时会自动抛出错误，所以 catch 块现在只会处理真正的失败
            // err 对象是 axios 封装的错误对象，err.message 包含了详细信息
            console.error('[TokenManager] Proactive token refresh failed:', err.message || err, now());
        } finally {
            // 3. 无论成功失败，必须解锁
            isRefreshingRef.current = false;
        }
    };

    // 启动定时器（每 30 秒检查一次）
    useEffect(() => {
        // 开发环境下 StrictMode 会导致这里运行两次
        // 我们利用 isRefreshingRef 也能一定程度上缓解，但最好还是清理干净

        console.log('[TokenManager] 启动 Token 预刷新定时器...');

        // 立即执行一次
        checkAndRefreshToken();

        refreshTimerRef.current = setInterval(checkAndRefreshToken, 30_000);

        return () => {
            if (refreshTimerRef.current) {
                console.log('[TokenManager] 清理 Token 预刷新定时器...');
                clearInterval(refreshTimerRef.current);
            }
        };
    }, []); // 仅在挂载时运行一次

    // 返回空对象，表示此 Hook 无外部消费接口（纯副作用）
    return {};
}
