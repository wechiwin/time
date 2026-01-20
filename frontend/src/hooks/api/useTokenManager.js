// src/hooks/useTokenManager.js
import {useEffect, useRef} from 'react';
import {isTokenExpiringSoon} from "../../utils/jwtUtils";
import SecureTokenStorage from "../../utils/tokenStorage";

/**
 * useTokenManager - 专职管理 Access Token 的生命周期
 * 功能：
 *  1. 启动定时器，定期检查 Token 是否即将过期
 *  2. 若即将过期（默认 <60s），则静默调用 /refresh 接口刷新
 *  3. 自动清理定时器，避免内存泄漏
 *
 * 使用方式：
 *   在 AuthProvider 或 App 组件中调用即可，无需消费返回值。
 */
export default function useTokenManager() {
    const refreshTimerRef = useRef(null);

    /**
     * 执行一次 Token 预刷新检查
     */
    const checkAndRefreshToken = async () => {
        const token = SecureTokenStorage.getAccessToken();
        if (!token) {
            console.warn('[TokenManager] 无有效 Token，跳过预刷新');
            return;
        }

        // 检查是否即将过期（提前 60 秒触发）
        if (!isTokenExpiringSoon(token, 60)) {
            console.debug('[TokenManager] Token 仍有效，无需刷新');
            return;
        }

        console.log('[TokenManager] Token 即将过期，启动预刷新...');

        try {
            const response = await fetch('/api/user_setting/refresh', {
                method: 'POST',
                credentials: 'include', // 必须携带 Cookie（用于 refresh_token）
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest' // 后端安全校验字段
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const newAccessToken = result?.data?.access_token;

            if (newAccessToken) {
                SecureTokenStorage.setAccessToken(newAccessToken);
                console.log('[TokenManager] ✅ Token 预刷新成功');
            } else {
                console.warn('[TokenManager] ⚠️ 响应中未包含 access_token:', result);
            }
        } catch (err) {
            // 不抛错，不影响主流程。被动刷新机制仍是后备方案。
            console.error('[TokenManager] ❌ Token 预刷新失败:', err.message || err);
        }
    };

    // 启动定时器（每 30 秒检查一次）
    useEffect(() => {
        console.log('[TokenManager] 启动 Token 预刷新定时器...');
        refreshTimerRef.current = setInterval(checkAndRefreshToken, 30_000);

        // 立即执行一次（防止刚登录时 Token 已临近过期）
        checkAndRefreshToken();

        // 清理函数：组件卸载时清除定时器
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
