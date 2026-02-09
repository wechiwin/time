import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRightIcon, LockClosedIcon, ShieldCheckIcon, UserIcon} from '@heroicons/react/24/outline';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUserSetting from "../hooks/api/useUserSetting";
import {useToast} from "../components/context/ToastContext";

export default function RegisterPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {register, loading} = useUserSetting();
    const {showSuccessToast} = useToast();

    const [formData, setFormData] = useState({username: '', password: '', confirmPassword: ''});
    const [touched, setTouched] = useState({username: false, password: false, confirmPassword: false});
    const [apiError, setApiError] = useState('');

    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
        if (apiError) setApiError('');
    };

    const handleBlur = (field) => setTouched(prev => ({...prev, [field]: true}));

    const getErrors = () => {
        const errors = {};
        if (touched.username && !formData.username) errors.username = t('field_required');
        else if (touched.username && formData.username.length < 3) errors.username = t('username_too_short');

        if (touched.password && !formData.password) errors.password = t('field_required');
        else if (touched.password && formData.password.length < 6) errors.password = t('password_too_short');

        if (touched.confirmPassword && !formData.confirmPassword) errors.confirmPassword = t('field_required');
        else if (touched.confirmPassword && formData.password !== formData.confirmPassword) errors.confirmPassword = t('password_mismatch');

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({username: true, password: true, confirmPassword: true});
        setApiError('');

        const errors = getErrors();
        if (Object.keys(errors).length > 0) return;

        try {
            await register(formData.username, formData.password);
            showSuccessToast(t('registration_success', '注册成功'));
            navigate('/dashboard');
        } catch (err) {
            setApiError(err.message);
        }
    };

    const errors = getErrors();

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300 py-12">

            {/* 背景装饰 (同登录页) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"/>
            <div className="absolute top-0 -left-4 w-96 h-96 bg-emerald-300 dark:bg-emerald-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob"/>
            <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-300 dark:bg-cyan-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"/>

            {/* 功能按钮 */}
            <div className="absolute top-6 right-6 flex items-center space-x-4 z-20 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm p-2 rounded-full border border-slate-200 dark:border-slate-700">
                <LanguageSwitcher placement="bottom"/>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"/>
                <DarkToggle/>
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800 rounded-2xl p-8 space-y-6">

                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {t('register_title', '创建账户')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {t('register_subtitle', '开启您的投资之旅')}
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                {t('username', '用户名')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-slate-400"/>
                                </div>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => handleChange('username', e.target.value)}
                                    onBlur={() => handleBlur('username')}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                    placeholder={t('username_placeholder', '请输入用户名（至少3位）')}
                                />
                            </div>
                            {errors.username && <p className="mt-1.5 text-xs text-red-500">{errors.username}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                {t('password', '密码')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <LockClosedIcon className="h-5 w-5 text-slate-400"/>
                                </div>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    onBlur={() => handleBlur('password')}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                    placeholder={t('password_placeholder', '请输入密码（至少6位）')}
                                />
                            </div>
                            {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                {t('confirm_password', '确认密码')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <ShieldCheckIcon className="h-5 w-5 text-slate-400"/>
                                </div>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                    onBlur={() => handleBlur('confirmPassword')}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                    placeholder={t('confirm_password_placeholder', '请再次输入密码')}
                                />
                            </div>
                            {errors.confirmPassword &&
                                <p className="mt-1.5 text-xs text-red-500">{errors.confirmPassword}</p>}
                        </div>

                        {/* API Error */}
                        {apiError && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r">
                                <p className="text-sm text-red-600 dark:text-red-300">{apiError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-slate-900 disabled:opacity-60 transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <span>{t('register_btn', '立即注册')}</span>
                                    <ArrowRightIcon className="h-4 w-4"/>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('already_have_account', '已有账户？')}{' '}
                            <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:underline">
                                {t('back_to_login', '立即登录')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}