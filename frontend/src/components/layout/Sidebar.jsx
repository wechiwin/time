import {NavLink} from 'react-router-dom';
import {
    HomeIcon,
    TableCellsIcon,
    ArrowsRightLeftIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';

const navigation = [
    {name: 'Dashboard', href: '/dashboard', icon: HomeIcon},
    {name: '基金管理', href: '/funds', icon: TableCellsIcon},
    {name: '交易管理', href: '/trades', icon: ArrowsRightLeftIcon},
    {name: '净值历史', href: '/netvalue', icon: ChartBarIcon},
];

export default function Sidebar() {
    return (
        <div className="w-64 bg-white shadow-md flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b">
        <span className="text-lg font-bold text-blue-600">
          基金投资管理系统
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
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.name}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}