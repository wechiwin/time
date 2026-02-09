import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRightIcon, LockClosedIcon, UserIcon} from '@heroicons/react/24/outline';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUserSetting from "../hooks/api/useUserSetting";
import {getYearString} from "../utils/timeUtil";

export default function LoginPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {login, loading} = useUserSetting();
    const [apiError, setApiError] = useState('');

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState({username: false, password: false});
    const year = getYearString()

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({username: true, password: true});
        setApiError('');

        if (!username || !password) return;

        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err) {
            setApiError(err.message || t('login_failed', '登录失败，请检查用户名或密码'));
        }

    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

            {/* 背景装饰：使用渐变模拟网格 */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"/>

            {/* 装饰性光斑 */}
            <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob"/>
            <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"/>
            <div className="absolute -bottom-8 left-20 w-96 h-96 bg-amber-300 dark:bg-amber-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"/>

            {/* 2. 右上角功能按钮 */}
            <div className="absolute top-6 right-6 flex items-center space-x-4 z-20 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm p-2 rounded-full border border-slate-200 dark:border-slate-700">
                <LanguageSwitcher placement="bottom"/>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"/>
                <DarkToggle/>
            </div>

            {/* 3. 主卡片容器 */}
            <div className="relative z-10 w-full max-w-md px-6">
                <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800 rounded-2xl p-8 space-y-8 transition-all duration-300 hover:shadow-slate-300/50 dark:hover:shadow-black/50">
                    {/* Header */}
                    <div className="text-center">
                        {/* Logo Placeholder */}
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg mb-4 transform -rotate-6">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {t('login_title', '欢迎回来')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {t('login_subtitle', '登录您的投资管理账户')}
                        </p>
                    </div>

                    {/* Form */}
                    <form className="space-y-6" onSubmit={handleSubmit}>

                        {/* Input Group: Username */}
                        <div>
                            <label htmlFor="username" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                {t('username', '用户名')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-slate-400" aria-hidden="true"/>
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onBlur={() => setTouched(prev => ({...prev, username: true}))}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                    placeholder={t('username_placeholder', '请输入用户名')}
                                />
                            </div>
                            {touched.username && !username && (
                                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                    <span>⚠</span> {t('field_required', '必填项')}
                                </p>
                            )}
                        </div>

                        {/* Input Group: Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                {t('password', '密码')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <LockClosedIcon className="h-5 w-5 text-slate-400" aria-hidden="true"/>
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched(prev => ({...prev, password: true}))}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                    placeholder={t('password_placeholder', '请输入密码')}
                                />
                            </div>
                            {touched.password && !password && (
                                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                    <span>⚠</span> {t('field_required', '必填项')}
                                </p>
                            )}
                        </div>

                        {/* API Error Alert */}
                        {apiError && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r flex items-center gap-3">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                                    </svg>
                                </div>
                                <p className="text-sm text-red-600 dark:text-red-300 font-medium">{apiError}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/30"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>{t('logging_in', '登录中...')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('login_btn', '登 录')}</span>
                                    <ArrowRightIcon className="h-4 w-4"/>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('no_account', '还没有账户？')}{' '}
                            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline transition-colors">
                                {t('register_now', '立即开户')}
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Copyright */}
                <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
                    © {year} T.I.M.E. All rights reserved.
                </p>
            </div>
        </div>
    );
}