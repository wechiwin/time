import React, {useState, useEffect} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import DarkToggle from "../components/layout/DarkToggle";
import useUserSetting from "../hooks/api/useUserSetting";
import {useToast} from "../components/context/ToastContext";

export default function RegisterPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {register, loading, error} = useUserSetting();
    const {showSuccessToast, showErrorToast} = useToast();

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [touched, setTouched] = useState({
        username: false,
        password: false,
        confirmPassword: false
    });

    const [apiError, setApiError] = useState('');
    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
        // 清除API错误当用户开始输入时
        if (apiError) setApiError('');
    };
    const handleBlur = (field) => {
        setTouched(prev => ({...prev, [field]: true}));
    };
    const validateForm = () => {
        const errors = {};

        if (!formData.username) errors.username = t('field_required', '此字段为必填项');
        else if (formData.username.length < 3) errors.username = t('username_too_short', '用户名至少需要3位字符');

        if (!formData.password) errors.password = t('field_required', '此字段为必填项');
        else if (formData.password.length < 6) errors.password = t('password_too_short', '密码至少需要6位字符');

        if (!formData.confirmPassword) errors.confirmPassword = t('field_required', '此字段为必填项');
        else if (formData.password !== formData.confirmPassword) errors.confirmPassword = t('password_mismatch', '两次输入的密码不一致');
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({username: true, password: true, confirmPassword: true});
        setApiError(''); // 清除之前的API错误

        const errors = validateForm();
        if (Object.keys(errors).length > 0) return;
        try {
            await register(formData.username, formData.password);
            showSuccessToast(t('registration_success', '注册成功'));
            navigate('/login');
        } catch (err) {
            setApiError(err.message);
            console.error("Registration failed", err);
        }
    };

    const errors = validateForm();

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            {/* 左下角的功能按钮区 */}
            <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                <LanguageSwitcher/>
                <DarkToggle/>
            </div>

            <div
                className="max-w-md w-full space-y-6 p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {t('register_title', '用户注册')}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t('register_subtitle', '创建您的个人账户')}
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
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                onBlur={() => handleBlur('username')}
                                className="input-field"
                                placeholder={t('username_placeholder', '请输入用户名（至少3位）')}
                            />
                            {touched.username && errors.username && (
                                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
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
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                onBlur={() => handleBlur('password')}
                                className="input-field"
                                placeholder={t('password_placeholder', '请输入密码（至少6位）')}
                            />
                            {touched.password && errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="confirmPassword"
                                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('confirm_password', '确认密码')}
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                onBlur={() => handleBlur('confirmPassword')}
                                className="input-field"
                                placeholder={t('confirm_password_placeholder', '请再次输入密码')}
                            />
                            {touched.confirmPassword && errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                            )}
                        </div>
                    </div>

                    {/* 错误提示显示 */}
                    {apiError && (
                        <div
                            className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                            {apiError || t('registration_failed', '注册失败')}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 text-base font-medium rounded-md transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {t('registering', '注册中...')}
                            </div>
                        ) : (
                            t('register_btn', '创建账户')
                        )}
                    </button>
                </form>

                {/* 返回登录链接 */}
                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('already_have_account', '已有账户？')}
                        <Link
                            to="/login"
                            className="ml-1 font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                            {t('back_to_login', '立即登录')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
