// utils/tokenStorage.js
class SecureTokenStorage {
    static ACCESS_KEY = 'access_token';
    static CSRF_KEY = 'csrf_token';

    static setAccessToken(accessToken) {
        if (!accessToken) {
            console.warn('Attempting to store empty access token');
            return;
        }

        try {
            localStorage.setItem(this.ACCESS_KEY, accessToken);
        } catch (error) {
            console.error('Failed to store CSRF token:', error);
        }
    }

    /**
     * 获取Access Token
     */
    static getAccessToken() {
        try {
            return localStorage.getItem(this.ACCESS_KEY);
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }

    /**
     * 获取CSRF Token
     */
    static getCsrfToken() {
        try {
            return localStorage.getItem(this.CSRF_KEY);
        } catch (error) {
            console.warn('Failed to get CSRF token:', error);
            return null;
        }
    }

    /**
     * 仅更新CSRF Token（用于token刷新后）
     */
    static setCsrfToken(csrfToken) {
        if (!csrfToken) {
            console.warn('Attempting to store empty CSRF token');
            return;
        }

        try {
            localStorage.setItem(this.CSRF_KEY, csrfToken);
        } catch (error) {
            console.error('Failed to store CSRF token:', error);
        }
    }

    /**
     * 清除所有tokens
     */
    static clearTokens() {
        try {
            localStorage.removeItem(this.ACCESS_KEY);
            localStorage.removeItem(this.CSRF_KEY);
        } catch (error) {
            console.error('Failed to clear tokens:', error);
        }
    }

    /**
     * 检查是否已认证
     */
    static isAuthenticated() {
        return !!this.getAccessToken();
    }

    static toString() {
        return "ACCESS_KEY:" + this.getAccessToken() + ";" + "CSRF_KEY:" + this.getCsrfToken();
    }
}

export default SecureTokenStorage;