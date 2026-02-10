// src/pages/RegisterPage.jsx
import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRightIcon, LockClosedIcon, ShieldCheckIcon, UserIcon} from '@heroicons/react/24/outline';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUserSetting from "../hooks/api/useUserSetting";
import {useToast} from "../components/context/ToastContext";
import FormField from "../components/common/FormField";

export default function RegisterPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {register, loading} = useUserSetting();
    const {showSuccessToast} = useToast();

    const [formData, setFormData] = useState({username: '', password: '', confirmPassword: ''});
    const [errors, setErrors] = useState({}); // 错误状态集中管理
    const [apiError, setApiError] = useState('');

    // 统一的校验逻辑
    const validateForm = (data) => {
        const newErrors = {};

        // 用户名校验
        if (!data.username) newErrors.username = t('field_required');
        else if (data.username.length < 3) newErrors.username = t('username_too_short');

        // 密码校验
        if (!data.password) newErrors.password = t('field_required');
        else if (data.password.length < 6) newErrors.password = t('password_too_short');

        // 确认密码校验 (核心修复点)
        if (!data.confirmPassword) newErrors.confirmPassword = t('field_required');
        else if (data.password !== data.confirmPassword) newErrors.confirmPassword = t('password_mismatch');

        return newErrors;
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
        // 清除当前字段的错误提示，提升用户体验
        if (errors[field]) {
            setErrors(prev => {
                const next = {...prev};
                delete next[field];
                return next;
            });
        }
        if (apiError) setApiError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setApiError('');

        // 关键修复：在提交时同步执行校验，不依赖 touched 状态
        const validationErrors = validateForm(formData);
        setErrors(validationErrors);

        // 如果有错误，阻止提交
        if (Object.keys(validationErrors).length > 0) return;

        try {
            await register(formData.username, formData.password);
            showSuccessToast(t('registration_success', '注册成功'));
            navigate('/dashboard');
        } catch (err) {
            setApiError(err.message);
        }
    };

    // 抽离 Label 样式，保持原有 UI 一致性
    const labelStyle = "block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2";

    return (
        <div
            className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300 py-12">

            {/* 背景装饰 (同登录页) */}
            <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"/>
            <div
                className="absolute top-0 -left-4 w-96 h-96 bg-emerald-300 dark:bg-emerald-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob"/>
            <div
                className="absolute top-0 -right-4 w-96 h-96 bg-cyan-300 dark:bg-cyan-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"/>

            {/* 功能按钮 */}
            <div
                className="absolute top-6 right-6 flex items-center space-x-4 z-20 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm p-2 rounded-full border border-slate-200 dark:border-slate-700">
                <LanguageSwitcher placement="bottom"/>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"/>
                <DarkToggle/>
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                <div
                    className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800 rounded-2xl p-8 space-y-6">

                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {t('register_title', '创建账户')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {t('register_subtitle', '开启您的投资之旅')}
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>

                        {/* Username Field */}
                        <FormField
                            label={t('username', '用户名')}
                            error={errors.username}
                            required
                            labelClassName={labelStyle}
                        >
                            {/* FormField 内部已经有 relative 容器，这里直接放 Icon 和 Input 即可 */}
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                <UserIcon className="h-5 w-5 text-slate-400"/>
                            </div>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                placeholder={t('username_placeholder', '请输入用户名（至少3位）')}
                            />
                        </FormField>

                        {/* Password Field */}
                        <FormField
                            label={t('password', '密码')}
                            error={errors.password}
                            required
                            labelClassName={labelStyle}
                        >
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                <LockClosedIcon className="h-5 w-5 text-slate-400"/>
                            </div>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                placeholder={t('password_placeholder', '请输入密码（至少6位）')}
                            />
                        </FormField>

                        {/* Confirm Password Field */}
                        <FormField
                            label={t('confirm_password', '确认密码')}
                            error={errors.confirmPassword}
                            required
                            labelClassName={labelStyle}
                        >
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                <ShieldCheckIcon className="h-5 w-5 text-slate-400"/>
                            </div>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                                placeholder={t('confirm_password_placeholder', '请再次输入密码')}
                            />
                        </FormField>

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
                            <Link to="/login"
                                  className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:underline">
                                {t('back_to_login', '立即登录')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}