// src/hooks/useTokenManager.js
import {useEffect, useRef} from 'react';
import SecureTokenStorage from "../utils/tokenStorage";
import {isTokenExpiringSoon} from "../utils/jwtUtils";
import {now} from "../utils/timeUtil";

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
            console.warn('[TokenManager] 无有效 Token，跳过预刷新', now());
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
            console.log('[TokenManager] ?? Token 即将过期，启动预刷新...', now());

            const response = await fetch('/time/user_setting/refresh', {
                method: 'POST',
                credentials: 'include', // 必须携带 Cookie（用于 refresh_token）
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest' // 后端安全校验字段
                },
                body: JSON.stringify({})
            });

            if (response.status === 401) {
                // 如果这里 401，说明 Refresh Token 彻底失效了，应该让 AuthContext 处理登出
                // 但不要在这里抛错，以免中断 Promise 链
                console.warn('[TokenManager] Refresh Token 已失效', now());
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const newAccessToken = result?.data?.access_token;

            if (newAccessToken) {
                SecureTokenStorage.setAccessToken(newAccessToken);
                console.log('[TokenManager] Token 预刷新成功', now());

                // 可选：触发一个事件通知其他组件 Token 已更新
                // window.dispatchEvent(new CustomEvent('AUTH_TOKEN_REFRESHED', { detail: { token: newAccessToken } }));
            }
        } catch (err) {
            // 不抛错，不影响主流程。被动刷新机制仍是后备方案。
            console.error('[TokenManager] Token 预刷新失败:', err.message || err, now());
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
