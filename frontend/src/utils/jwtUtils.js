// src/utils/jwtUtils.js

/**
 * 解析 JWT Token，返回 payload
 * @param {string} token - JWT 字符串
 * @returns {object|null} payload 对象，或 null（如果解析失败）
 */
export function parseJwt(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.warn('Failed to parse JWT:', e.message);
        return null;
    }
}

/**
 * 检查 Token 是否即将过期
 * @param {string} token - JWT 字符串
 * @param {number} preRefreshSeconds - 提前多少秒刷新（默认 60 秒）
 * @returns {boolean} 是否需要刷新
 */
export function isTokenExpiringSoon(token, preRefreshSeconds = 60) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) {
        return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < preRefreshSeconds;
}
