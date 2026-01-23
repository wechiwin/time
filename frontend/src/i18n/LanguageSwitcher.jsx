import {Fragment} from 'react';
import {Menu, Transition} from '@headlessui/react';
import {GlobeAltIcon} from '@heroicons/react/24/outline';
import {useTranslation} from 'react-i18next';
import {LANGUAGES} from "../constants/sysConst";

function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

export default function LanguageSwitcher() {
    const {i18n} = useTranslation();

    const handleChangeLanguage = (code) => {
        // 立即保存到localStorage以确保记住用户选择
        localStorage.setItem('i18nextLng', code);
        i18n.changeLanguage(code);
    };

    return (
        <Menu as="div" className="relative inline-block text-left">
            {/* 触发按钮：一个简单的地球图标 */}
            <div>
                <Menu.Button
                    className="flex items-center justify-center p-2 text-gray-500 rounded-md hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none transition-colors">
                    <GlobeAltIcon className="w-6 h-6" aria-hidden="true"/>
                    {/* 显示当前语言缩写 */}
                    <span className="ml-1 text-xs font-medium">
                        {i18n.language ? i18n.language.toUpperCase() : 'ZH'}
                    </span>
                </Menu.Button>
            </div>

            {/* 下拉菜单动画与内容 */}
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                {/* 这里使用 bottom-full 和 mb-2 让菜单向上弹出 */}
                <Menu.Items
                    className="absolute bottom-full left-0 mb-2 w-32 origin-bottom-left bg-white dark:bg-gray-700 divide-y divide-gray-100 dark:divide-gray-600 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                        {LANGUAGES.map((lang) => (
                            <Menu.Item key={lang.code}>
                                {({active}) => (
                                    <button
                                        onClick={() => handleChangeLanguage(lang.code)}
                                        className={classNames(
                                            active ? 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200',
                                            'group flex w-full items-center px-4 py-2 text-sm'
                                        )}
                                    >
                    <span
                        className={`mr-2 ${i18n.language === lang.code ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                        {lang.name}
                    </span>
                                    </button>
                                )}
                            </Menu.Item>
                        ))}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}