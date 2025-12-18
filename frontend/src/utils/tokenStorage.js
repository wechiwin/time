// utils/tokenStorage.js
let memoryStorage = {
    accessToken: null,
    csrfToken: null
};
// 使用CryptoJS进行加密存储
import CryptoJS from 'crypto-js';
// 从环境变量或配置获取密钥（实际项目中应通过后端动态获取）
const ENCRYPTION_KEY = import.meta.env.VITE_TOKEN_ENC_KEY || 'your-secret-key-change-in-production';

class SecureTokenStorage {
    // 加密数据
    static encrypt(data) {
        try {
            return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    // 解密数据
    static decrypt(encryptedData) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    // 存储tokens - 只加密存储access_token，refresh_token由后端httpOnly cookie管理
    static setTokens(accessToken, csrfToken = null) {
        try {
            // Access Token存储在内存中
            memoryStorage.accessToken = accessToken;

            // 同时加密存储到sessionStorage作为备份（可选）
            if (accessToken) {
                const encrypted = this.encrypt(accessToken);
                sessionStorage.setItem('access_token_enc', encrypted);
            }

            // 存储CSRF Token
            if (csrfToken) {
                memoryStorage.csrfToken = csrfToken;
                sessionStorage.setItem('csrf_token', csrfToken);
            }
        } catch (error) {
            console.warn('Failed to store tokens:', error);
        }
    }

    // 获取Access Token
    static getAccessToken() {
        try {
            // 优先从内存获取
            if (memoryStorage.accessToken) {
                return memoryStorage.accessToken;
            }

            // 其次从sessionStorage解密获取（页面刷新场景）
            const encrypted = sessionStorage.getItem('access_token_enc');
            if (encrypted) {
                const decrypted = this.decrypt(encrypted);
                memoryStorage.accessToken = decrypted; // 恢复到内存
                return decrypted;
            }

            return null;
        } catch (error) {
            console.warn('Failed to get access token:', error);
            return null;
        }
    }

    // 获取CSRF Token
    static getCsrfToken() {
        try {
            return memoryStorage.csrfToken || sessionStorage.getItem('csrf_token');
        } catch (error) {
            console.warn('Failed to get CSRF token:', error);
            return null;
        }
    }

    // 清除所有tokens
    static clearTokens() {
        try {
            // 清除内存
            memoryStorage = {accessToken: null, csrfToken: null};

            // 清除sessionStorage
            sessionStorage.removeItem('access_token_enc');
            sessionStorage.removeItem('csrf_token');
        } catch (error) {
            console.warn('Failed to clear tokens:', error);
        }
    }

    // 设置Token过期时间
    static setTokenExpiry(expiryTime) {
        try {
            sessionStorage.setItem('token_expiry', expiryTime.toString());
        } catch (error) {
            console.warn('Failed to set token expiry:', error);
        }
    }

    // 检查Token是否过期
    static isTokenExpired() {
        try {
            const expiry = sessionStorage.getItem('token_expiry');
            if (!expiry) return true;
            return Date.now() > parseInt(expiry);
        } catch (error) {
            console.warn('Failed to check token expiry:', error);
            return true;
        }
    }
}

export default SecureTokenStorage;