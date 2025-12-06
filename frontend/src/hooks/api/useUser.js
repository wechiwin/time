import {useCallback, useState} from 'react';
import useApi from "../useApi";
import {HASH_ITERATIONS, SALT} from "../../constants/sysConst";
import CryptoJS from 'crypto-js';

export default function useUser() {
    const {loading, error, post, get} = useApi();
    const [currentUser, setCurrentUser] = useState(null);

    // 登录接口
    const login = useCallback(async (username, password) => {
        const result = await post('/api/user/login', {
            username,
            password: secureHash(password)
        });

        if (result && result.access_token) {
            // 存储 Token
            localStorage.setItem('access_token', result.access_token);
            return result;
        }
        return null;
    }, [post]);

    // 获取用户信息
    const fetchUserProfile = useCallback(async () => {
        const result = await get('/api/user/protected');
        setCurrentUser(result);
        return result;
    }, [get]);

    // 登出
    const logout = useCallback(() => {
        localStorage.removeItem('access_token');
        setCurrentUser(null);
    }, []);

    // 注册接口
    const register = useCallback(async (username, password) => {
        const result = await post('/api/user/register', {
            username,
            password: secureHash(password)
        });
        if (result && result.access_token) {
            localStorage.setItem('access_token', result.access_token);
            return result;
        }
        return null;
    }, [post]);

    const secureHash = (password) => {
        const saltedPassword = SALT + password;
        return CryptoJS.PBKDF2(saltedPassword, SALT, {
            keySize: 512 / 32,
            iterations: HASH_ITERATIONS
        }).toString();
    };

    return {
        loading,
        error,
        login,
        logout,
        fetchUserProfile,
        currentUser,
        register
    };
}