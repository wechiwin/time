import {Fragment} from 'react';
import {Menu, Transition} from '@headlessui/react';
import {useTranslation} from 'react-i18next';
import {LANGUAGES} from "../constants/sysConst";

function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

export default function LanguageSwitcher({placement = 'bottom'}) {
    const {i18n} = useTranslation();

    const handleChangeLanguage = (code) => {
        // 立即保存到localStorage以确保记住用户选择
        localStorage.setItem('i18nextLng', code);
        i18n.changeLanguage(code);
    };

    // 根据位置动态设置菜单的定位样式
    const positionClasses = placement === 'top'
        ? "bottom-full left-0 mb-2 origin-bottom-left" // Sidebar场景：向上
        : "top-full right-0 mt-2 origin-top-right";    // Header场景：向下

    return (
        <Menu as="div" className="relative inline-block text-left">
            <div>
                <Menu.Button
                    className="flex items-center justify-center p-2 text-gray-500 rounded-md hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none transition-colors"
                    aria-label="Switch language"
                >
                    {/* 显示当前语言缩写 */}
                    <span className="text-s font-medium">
                        {i18n.language ? i18n.language.toUpperCase() : 'EN'}
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
                <Menu.Items
                    className={classNames(
                        "absolute z-50 w-36 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                        positionClasses
                    )}
                >
                    <div className="py-1">
                        {LANGUAGES.map((lang) => (
                            <Menu.Item key={lang.code}>
                                {({active}) => (
                                    <button
                                        onClick={() => handleChangeLanguage(lang.code)}
                                        className={classNames(
                                            active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200',
                                            'group flex w-full items-center px-4 py-2 text-sm'
                                        )}
                                    >
                                        <span className={`mr-2 ${i18n.language === lang.code ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
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