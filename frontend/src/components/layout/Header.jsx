import DarkToggle from './DarkToggle';
import {useLocation} from 'react-router-dom';

const nameMap = {
    '/dashboard': 'Dashboard',
    '/funds': '持仓管理',
    '/trades': '交易管理',
    '/netvalue': '净值历史',
};

export default function Header() {
    const {pathname} = useLocation();            // 拿到当前路径
    const title = nameMap[pathname] || 'Dashboard'; // 兜底

    return (
        <header className="card dark:bg-gray-800 shadow-sm h-16 flex items-center justify-between px-6">
            {/* <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h2> */}
            <h1 className="text-2xl font-bold">{title}</h1>
            <DarkToggle/>
        </header>
    );
}