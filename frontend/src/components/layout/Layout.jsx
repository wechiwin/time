// src/components/layout/Layout.jsx
import {useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import Sidebar from './Sidebar';
import TabsBar from './TabsBar';
import Drawer from '../common/Drawer';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    // 从路径生成唯一 key（如 /funds => "funds"）
    const currentKey = location.pathname.split('/')[1] || 'dashboard';

    // Tabs 状态
    const [tabs, setTabs] = useState([{key: 'dashboard', name: 'Dashboard', path: '/dashboard'}]);
    const [activeKey, setActiveKey] = useState(currentKey);

    // Drawer 状态
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState(null);

    // 切换菜单（来自 Sidebar）
    const handleSelectMenu = (item) => {
        const existing = tabs.find((t) => t.key === item.key);
        if (!existing) {
            setTabs([...tabs, item]);
        }
        setActiveKey(item.key);
        navigate(item.path);
    };

    // 切换标签页
    const handleSwitchTab = (key) => {
        setActiveKey(key);
        const target = tabs.find((t) => t.key === key);
        if (target) navigate(target.path);
    };

    // 关闭标签页
    const handleCloseTab = (key) => {
        const newTabs = tabs.filter((t) => t.key !== key);
        setTabs(newTabs);
        if (activeKey === key && newTabs.length > 0) {
            const lastTab = newTabs[newTabs.length - 1];
            setActiveKey(lastTab.key);
            navigate(lastTab.path);
        }
    };

    // 提供给页面组件的 Drawer 控制函数（通过 context）
    const showDrawer = (content) => {
        setDrawerContent(content);
        setDrawerOpen(true);
    };
    const closeDrawer = () => setDrawerOpen(false);
    return (
        <div className="flex h-screen page-bg dark:bg-gray-900">
            <Sidebar onSelect={handleSelectMenu} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet/>
                </main>
            </div>
        </div>
    );
}