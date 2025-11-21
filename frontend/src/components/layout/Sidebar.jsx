import {NavLink} from 'react-router-dom';
import {ArrowsRightLeftIcon, ChartBarIcon, HomeIcon, TableCellsIcon,} from '@heroicons/react/24/outline';
import DarkToggle from "./DarkToggle";
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from "../../i18n/LanguageSwitcher";

const navigation = [
    {key: 'menu_dashboard', name: 'Dashboard', href: '/dashboard', icon: HomeIcon},
    {key: 'menu_holding', name: '持仓管理', href: '/holding', icon: TableCellsIcon},
    {key: 'menu_trade', name: '交易管理', href: '/trade', icon: ArrowsRightLeftIcon},
    {key: 'menu_nav_history', name: '净值历史', href: '/nav_history', icon: ChartBarIcon},
];

export default function Sidebar() {
    const {t} = useTranslation();

    return (
        <div className="relative w-64 card dark:bg-gray-800 shadow-md flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b">
                <span className="text-lg font-bold text-blue-600">
                  {t('project_title')}
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        className={({isActive}) =>
                            `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 mr-3"/>
                        {t(`${item.key}`, item.name)}
                    </NavLink>
                ))}
            </nav>

            {/* 右下角暗黑开关 */}
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                <LanguageSwitcher />
                <DarkToggle />
            </div>
        </div>
    );
}