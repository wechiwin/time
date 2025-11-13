import {NavLink} from 'react-router-dom';
import {
    HomeIcon,
    TableCellsIcon,
    ArrowsRightLeftIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import DarkToggle from "./DarkToggle";

const navigation = [
    {name: 'Dashboard', href: '/dashboard', icon: HomeIcon},
    {name: '持仓管理', href: '/holding', icon: TableCellsIcon},
    {name: '交易管理', href: '/trade', icon: ArrowsRightLeftIcon},
    {name: '净值历史', href: '/nav_history', icon: ChartBarIcon},
];

export default function Sidebar() {
    return (
        <div className="relative w-64 card dark:bg-gray-800 shadow-md flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b">
                <span className="text-lg font-bold text-blue-600">
                  投资持仓管理系统
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
                        {item.name}
                    </NavLink>
                ))}
            </nav>

            {/* 右下角暗黑开关 */}
            <div className="absolute bottom-4 right-4">
                <DarkToggle/>
            </div>
        </div>
    );
}