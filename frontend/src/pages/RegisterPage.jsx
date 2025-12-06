import React, {useState, useEffect} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUser from "../hooks/api/useUser";
import {useToast} from "../components/toast/ToastContext";

export default function RegisterPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {register, loading, error} = useUser();

    // 表单状态
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const {showSuccessToast, showErrorToast} = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showErrorToast(t('password_mismatch', '两次输入的密码不一致'));
            return;
        }

        if (password.length < 6) {
            showErrorToast(t('password_too_short', '密码至少需要6位字符'));
            return;
        }

        try {
            await register(username, password);
            // 注册成功后自动登录并跳转到dashboard
            navigate('/dashboard');
        } catch (err) {
            console.error("Registration failed", err);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            {/* 右下角的功能按钮区 */}
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                <LanguageSwitcher/>
                <DarkToggle/>
            </div>

            <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        {t('register_title', '初始化管理员账户')}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        {t('register_subtitle', '这是系统的第一个用户账户')}
                    </p>
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
                                placeholder={t('username_placeholder', '请输入用户名（至少3位）')}
                                minLength="3"
                            />
                        </div>
                        <div className="mb-4">
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
                                placeholder={t('password_placeholder', '请输入密码（至少6位）')}
                                minLength="6"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('confirm_password', '确认密码')}
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder={t('confirm_password_placeholder', '请再次输入密码')}
                            />
                        </div>
                    </div>

                    {/* 错误提示显示 */}
                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {error.message || t('registration_failed', '注册失败')}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white 
                                ${loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} 
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                        >
                            {loading ? t('registering', '注册中...') : t('register_btn', '创建账户')}
                        </button>
                    </div>
                </form>

                {/* 返回登录链接 */}
                <div className="text-center mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <Link
                            to="/login"
                            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            {t('back_to_login', '返回登录')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
