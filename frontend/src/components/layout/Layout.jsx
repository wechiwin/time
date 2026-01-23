import {useState, useRef} from 'react';
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

    // --- 新增：控制移动端浮动按钮显示的逻辑 ---
    const [showFloatingButton, setShowFloatingButton] = useState(true);
    const lastScrollTop = useRef(0);

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

    // --- 新增：处理主内容区域滚动 ---
    const handleMainScroll = (e) => {
        const currentScrollTop = e.target.scrollTop;
        const scrollDelta = currentScrollTop - lastScrollTop.current;

        // 简单的防抖/阈值逻辑：
        // 1. 如果向下滚动超过 10px，隐藏按钮
        // 2. 如果向上滚动，立即显示按钮
        if (scrollDelta > 10 && currentScrollTop > 20) {
            setShowFloatingButton(false);
        } else if (scrollDelta < -5) {
            setShowFloatingButton(true);
        }

        lastScrollTop.current = currentScrollTop;
    };

    return (
        <div className="flex h-screen page-bg bg-white dark:bg-gray-900 dark:text-gray-100 overflow-hidden">
            {/* 侧边栏 */}
            <Sidebar
                onSelect={handleSelectMenu}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebar}
                showFloatingButton={showFloatingButton}
            />
            {/* 主内容区域 */}
            <div className={`
                flex-1 
                flex flex-col 
                overflow-hidden
                transition-all duration-300
                ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}
            `}>
                {/*
                   新增：onScroll 事件监听
                   注意：滚动发生在 main 标签上，而不是 window
                */}
                <main
                    className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50 dark:bg-gray-800 scroll-smooth"
                    onScroll={handleMainScroll}
                >
                    <Outlet/>
                </main>
            </div>
        </div>
    );
}
