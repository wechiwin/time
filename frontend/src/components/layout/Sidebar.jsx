import {useEffect, useState} from 'react';
import {NavLink, useNavigate} from 'react-router-dom';
import {
    ArrowRightOnRectangleIcon,
    ArrowsRightLeftIcon,
    Bars3Icon,
    ChartBarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    Cog6ToothIcon,
    HomeIcon,
    TableCellsIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import DarkToggle from "./DarkToggle";
import {useTranslation} from 'react-i18next';
import LanguageSwitcher from "../../i18n/LanguageSwitcher";
import {BellIcon} from "@heroicons/react/16/solid";
import useUserSetting from "../../hooks/api/useUserSetting";
import UserSettingForm from "../forms/UserSettingForm";
import FormModal from "../common/FormModal";

const navigation = [
    {key: 'menu_dashboard', name: 'Dashboard', href: '/dashboard', icon: HomeIcon},
    {key: 'menu_holding', name: '持仓管理', href: '/holding', icon: TableCellsIcon},
    {key: 'menu_alert', name: '持仓监控', href: '/alert', icon: BellIcon},
    {key: 'menu_trade', name: '交易管理', href: '/trade', icon: ArrowsRightLeftIcon},
    {key: 'menu_nav_history', name: '净值历史', href: '/nav_history', icon: ChartBarIcon},
];

export default function Sidebar({onSelect, isCollapsed, onToggleCollapse}) {
    const {t} = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const navigate = useNavigate();
    const {logout, fetchUserProfile, updateUser} = useUserSetting();

    // 模态框状态
    const [showUserSettingModal, setShowUserSettingModal] = useState(false);
    const [userSettingInitialValues, setUserSettingInitialValues] = useState({});

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => setIsOpen(!isOpen);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenUserSetting = async () => {
        try {
            const userData = await fetchUserProfile();
            setUserSettingInitialValues(userData);
        } catch (error) {
            setUserSettingInitialValues({});
            console.log(error)
        }
        setShowUserSettingModal(true);
    };
    const handleSaveUserSetting = async (formData) => {
        try {
            await updateUser(formData);
            // 可以在这里更新全局用户状态或重新获取用户信息
        } catch (error) {
            throw error; // 让 FormModal 处理错误
        }
    };

    return (
        <>
            {/* 汉堡菜单按钮 */}
            <button
                onClick={toggleSidebar}
                className={`fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md transition-opacity
                    ${isMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-label="Toggle sidebar"
                aria-expanded={isOpen}
            >
                {isOpen ? <XMarkIcon className="w-6 h-6"/> : <Bars3Icon className="w-6 h-6"/>}
            </button>

            {/* 侧边栏 */}
            <div
                className={`fixed top-0 left-0 h-screen card dark:bg-gray-800 shadow-md flex flex-col transition-all duration-300 ease-in-out z-40
                    ${isMobile
                    ? `w-64 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
                    : `${isCollapsed ? 'w-20' : 'w-64'} translate-x-0`}`}
            >
                {/* Logo */}
                <div
                    className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <span className={`text-lg font-bold text-blue-600 ${isCollapsed && !isMobile ? 'hidden' : ''}`}>
                        {t('project_title')}
                    </span>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            onClick={() => isMobile && setIsOpen(false)}
                            className={({isActive}) =>
                                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                        >
                            <item.icon className={`w-5 h-5 ${isCollapsed && !isMobile ? '' : 'mr-3'}`}/>
                            <span className={`${isCollapsed && !isMobile ? 'hidden' : ''}`}>
                                {t(`${item.key}`, item.name)}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                {/* 折叠按钮 - 仅PC端 */}
                {!isMobile && (
                    <button
                        onClick={onToggleCollapse}
                        className="absolute top-4 right-4 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        aria-label="Collapse sidebar"
                    >
                        {isCollapsed ?
                            <ChevronRightIcon className="w-5 h-5"/> :
                            <ChevronLeftIcon className="w-5 h-5"/>
                        }
                    </button>
                )}

                {/* 右下角按钮 */}
                <div
                    className={`absolute bottom-4 right-4 transition-all duration-200 ${
                        isCollapsed && !isMobile
                            ? 'flex flex-col items-center space-y-2'  // 竖向排列
                            : 'flex items-center space-x-2'           // 横向排列
                    }`}
                >
                    <LanguageSwitcher/>
                    <DarkToggle/>
                    {/* 个人设置按钮 */}
                    <button
                        onClick={handleOpenUserSetting}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="User Settings"
                        title={t('user_settings')}
                    >
                        <Cog6ToothIcon className="w-5 h-5 text-gray-700 dark:text-gray-200"/>
                    </button>
                    {/* 退出按钮 */}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Logout"
                        title="退出登录"
                    >
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-gray-700 dark:text-gray-200"/>
                    </button>
                </div>
            </div>

            {/* 遮罩层 */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30"
                    onClick={toggleSidebar}
                />
            )}
            {/* 个人设置模态框 */}
            <FormModal
                title={t('user_settings')}
                show={showUserSettingModal}
                onClose={() => setShowUserSettingModal(false)}
                onSubmit={handleSaveUserSetting}
                FormComponent={UserSettingForm}
                initialValues={userSettingInitialValues}
            />
        </>
    );
}