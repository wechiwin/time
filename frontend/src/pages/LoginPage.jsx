import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUser from "../hooks/api/useUser"; //

export default function LoginPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {login, loading, error} = useUser();

    // 表单状态
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            // 登录成功后跳转到 dashboard
            navigate('/dashboard');
        } catch (err) {
            // useApi 通常会处理错误，这里可以留空或做额外的 UI 震动效果
            console.error("Login failed", err);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                <LanguageSwitcher/>
                <DarkToggle/>
            </div>

            <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        {t('login_title', '登录系统')}
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="username"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('username', '用户名')}
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder={t('username_placeholder', '请输入用户名')}
                            />
                        </div>
                        <div>
                            <label htmlFor="password"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('password', '密码')}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder={t('password_placeholder', '请输入密码')}
                            />
                        </div>
                    </div>

                    {/* 错误提示显示 */}
                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {error.message || t('login_failed', '登录失败，请检查用户名或密码')}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white 
                                ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                            {loading ? t('logging_in', '登录中...') : t('login_btn', '登 录')}
                        </button>
                    </div>
                </form>
                <div className="text-center mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('no_account', '还没有账户？')}
                        <Link
                            to="/register"
                            className="ml-1 text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            {t('register_now', '立即注册')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}