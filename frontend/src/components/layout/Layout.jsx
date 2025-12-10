// src/components/layout/Layout.jsx
import {useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    // 从路径生成唯一 key（如 /funds => "funds"）
    const currentKey = location.pathname.split('/')[1] || 'dashboard';

    // Tabs 状态
    const [tabs, setTabs] = useState([{key: 'dashboard', name: 'Dashboard', path: '/dashboard'}]);
    const [activeKey, setActiveKey] = useState(currentKey);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // 切换菜单（来自 Sidebar）
    const handleSelectMenu = (item) => {
        const existing = tabs.find((t) => t.key === item.key);
        if (!existing) {
            setTabs([...tabs, item]);
        }
        setActiveKey(item.key);
        navigate(item.path);
    };

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    return (
        <div className="flex h-screen page-bg dark:bg-gray-900 overflow-hidden">
            {/* 侧边栏 */}
            <Sidebar
                onSelect={handleSelectMenu}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebar}
            />
            {/* 主内容区域 */}
            <div className={`
                flex-1 
                flex flex-col 
                overflow-hidden
                transition-all duration-300
                ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}
            `}>
                <main className="flex-1 overflow-y-auto p-3 md:p-6">
                    <Outlet/>
                </main>
            </div>
        </div>
    );
}
