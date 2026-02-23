// src/pages/NotFoundPage.jsx
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {HomeIcon, ArrowLeftIcon} from '@heroicons/react/24/outline';

export default function NotFoundPage() {
    const {t} = useTranslation();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full text-center">
                {/* 404 数字 */}
                <div className="mb-8">
                    <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700">
                        404
                    </h1>
                </div>

                {/* 图标 */}
                <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <svg
                            className="w-10 h-10 text-blue-600 dark:text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                </div>

                {/* 标题 */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {t('not_found_title', '页面未找到')}
                </h2>

                {/* 描述 */}
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    {t('not_found_description', '抱歉，您访问的页面不存在或已被移除。')}
                </p>

                {/* 按钮组 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                    >
                        <HomeIcon className="w-4 h-4 mr-2"/>
                        {t('back_to_home', '返回首页')}
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4 mr-2"/>
                        {t('go_back', '返回上一页')}
                    </button>
                </div>
            </div>
        </div>
    );
}
