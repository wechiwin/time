// utils/tokenStorage.js
export const tokenStorage = {
    // 存储tokens
    setTokens: (accessToken, refreshToken) => {
        try {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
        } catch (error) {
            console.warn('Failed to store tokens:', error);
        }
    },

    getAccessToken: () => {
        try {
            return localStorage.getItem('access_token');
        } catch (error) {
            console.warn('Failed to get access token:', error);
            return null;
        }
    },

    setAccessToken: (token) => {
        try {
            localStorage.setItem('access_token', token);
        } catch (error) {
            console.warn('Failed to store access token:', error);
        }
    },

    getRefreshToken: () => {
        try {
            return localStorage.getItem('refresh_token');
        } catch (error) {
            console.warn('Failed to get refresh token:', error);
            return null;
        }
    },

    setRefreshToken: (token) => {
        try {
            localStorage.setItem('refresh_token', token);
        } catch (error) {
            console.warn('Failed to store refresh token:', error);
        }
    },

    clearTokens: () => {
        try {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        } catch (error) {
            console.warn('Failed to clear tokens:', error);
        }
    }
};
