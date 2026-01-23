// utils/tokenStorage.js
class SecureTokenStorage {
    static ACCESS_KEY = 'access_token';

    static setAccessToken(accessToken) {
        if (!accessToken) {
            console.warn('Attempting to store empty access token');
            return;
        }

        try {
            localStorage.setItem(this.ACCESS_KEY, accessToken);
        } catch (error) {
            console.error('Failed to store token:', error);
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
     * 清除所有tokens
     */
    static clearTokens() {
        try {
            localStorage.removeItem(this.ACCESS_KEY);
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
        return "ACCESS_KEY:" + this.getAccessToken();
    }
}

export default SecureTokenStorage;