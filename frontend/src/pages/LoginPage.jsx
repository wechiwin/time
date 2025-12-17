import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUserSetting from "../hooks/api/useUserSetting";

export default function LoginPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {login, loading, error} = useUserSetting();
    const [apiError, setApiError] = useState('');

    // 表单状态
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState({username: false, password: false});

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({username: true, password: true});
        setApiError(''); // 清除之前的错误

        if (!username || !password) return;

        try {
            await login(username, password);
            // 登录成功后跳转到 dashboard
            navigate('/dashboard');
        } catch (err) {
            setApiError(err.message); // 显示具体的错误信息
            console.error("Login failed", err);
        }
    };

    const handleBlur = (field) => {
        setTouched(prev => ({...prev, [field]: true}));
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="absolute top-4 right-4 flex items-center space-x-2">
                <LanguageSwitcher/>
                <DarkToggle/>
            </div>

            <div
                className="max-w-md w-full space-y-6 p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {t('login_title', '登录系统')}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t('login_subtitle', '欢迎回来，请登录您的账户')}
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('username', '用户名')}
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onBlur={() => handleBlur('username')}
                                className="input-field"
                                placeholder={t('username_placeholder', '请输入用户名')}
                            />
                            {touched.username && !username && (
                                <p className="mt-1 text-sm text-red-600">{t('field_required', '此字段为必填项')}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="password"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('password', '密码')}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onBlur={() => handleBlur('password')}
                                className="input-field"
                                placeholder={t('password_placeholder', '请输入密码')}
                            />
                            {touched.password && !password && (
                                <p className="mt-1 text-sm text-red-600">{t('field_required', '此字段为必填项')}</p>
                            )}
                        </div>
                    </div>

                    {/* 错误提示显示 */}
                    {apiError && (
                        <div
                            className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                            {apiError || t('login_failed', '登录失败，请检查用户名或密码')}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary py-3 px-4 text-base font-medium rounded-md transition-colors"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {t('logging_in', '登录中...')}
                            </div>
                        ) : (
                            t('login_btn', '登 录')
                        )}
                    </button>
                </form>

                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('no_account', '还没有账户？')}
                        <Link
                            to="/register"
                            className="ml-1 font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                            {t('register_now', '立即注册')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}