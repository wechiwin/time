import {useState} from 'react';
import {NavLink, useNavigate} from 'react-router-dom';
import {
    ArrowRightOnRectangleIcon,
    ArrowsRightLeftIcon,
    Bars3Icon,
    ChartBarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
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
import {useIsMobile} from "../../hooks/useIsMobile";
import useDarkMode from "../../hooks/useDarkMode";

const navigation = [
    {key: 'menu_dashboard', name: 'Dashboard', href: '/dashboard', icon: HomeIcon},
    {key: 'menu_holding', name: '持仓管理', href: '/holding', icon: TableCellsIcon},
    {key: 'menu_alert', name: '持仓监控', href: '/alert', icon: BellIcon},
    {key: 'menu_trade', name: '交易管理', href: '/trade', icon: ArrowsRightLeftIcon},
    {key: 'menu_history_trend', name: '历史走势', href: '/historical_trend', icon: ChartBarIcon},
    {key: 'menu_task_logs', name: '任务运行', href: '/task_logs', icon: ClockIcon},
];

// 新增 prop: showFloatingButton (默认为 true)
export default function Sidebar({onSelect, isCollapsed, onToggleCollapse, showFloatingButton = true}) {
    const {t} = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const {logout, fetchUserProfile, updateUser} = useUserSetting();
    const isDarkMode = useDarkMode();

    // 模态框状态
    const [showUserSettingModal, setShowUserSettingModal] = useState(false);
    const [userSettingInitialValues, setUserSettingInitialValues] = useState({});

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

    // 计算浮动按钮是否可见
    // 规则：是移动端 AND 侧边栏未打开 AND (父组件允许显示 OR 页面未滚动)
    const isFloatingButtonVisible = isMobile && !isOpen && showFloatingButton;

    return (
        <>
            {/* 1. 移动端浮动汉堡按钮 (FAB) */}
            <button
                onClick={toggleSidebar}
                className={`fixed top-4 left-4 z-50 p-2.5 rounded-full 
                    bg-white/80 dark:bg-slate-800/80 backdrop-blur-md 
                    shadow-lg border border-slate-200/50 dark:border-slate-700/50
                    text-slate-600 dark:text-slate-300
                    transition-all duration-300 ease-in-out
                    ${isFloatingButtonVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}
                aria-label="Toggle sidebar"
            >
                <Bars3Icon className="w-5 h-5"/>
            </button>

            {/* 2. 侧边栏主体 */}
            <div className={`fixed top-0 left-0 h-screen z-40
                    flex flex-col
                    bg-white/90 dark:bg-slate-900/80 
                    backdrop-blur-xl 
                    border-r border-slate-200/50 dark:border-slate-800/50
                    shadow-sm
                    transition-all duration-300 ease-in-out
                    ${isMobile
                ? `w-64 transform ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`
                : `${isCollapsed ? 'w-20' : 'w-64'} translate-x-0`}
                `}
            >
                {/* Logo & Header */}
                <div className={`
                    h-16 flex items-center justify-between 
                    border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0
                    ${isCollapsed && !isMobile ? 'px-3' : 'px-4'} 
                    /* 收起时 px-3 (12px) + 下面的 ml-3 (12px) = 24px，与导航区对齐 */
                    /* 展开时保持 px-4，视觉平衡 */
                `}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        {/* Logo */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                        </div>
                        <span className={`font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 transition-opacity duration-300 ${isCollapsed && !isMobile ? 'opacity-0 w-0' : 'opacity-100'}`}>
                            {/* {t('project_title')} */}
                            T.I.M.E.
                        </span>
                    </div>

                    {/* 移动端关闭按钮 */}
                    {isMobile && (
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500"
                        >
                            <XMarkIcon className="w-5 h-5"/>
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            onClick={() => isMobile && setIsOpen(false)}
                            className={({isActive}) =>
                                `group relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' // Active state
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/30' // Inactive state
                                }
                                ${isCollapsed && !isMobile ? 'justify-center' : ''}
                                `
                            }
                        >
                            {({isActive}) => (
                                <>
                                    {/* Active Indicator Bar */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full"/>
                                    )}

                                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isCollapsed && !isMobile ? '' : 'mr-3'} ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}/>
                                    <span className={`truncate transition-opacity duration-200 ${isCollapsed && !isMobile ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                        {t(`${item.key}`, item.name)}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* PC Collapse Button */}
                {!isMobile && (
                    <button
                        onClick={onToggleCollapse}
                        className="absolute top-20 -right-3 z-50 p-1 rounded-full
                        bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                        text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400
                        shadow-sm hover:shadow-md transition-all"
                        aria-label="Collapse sidebar"
                    >
                        {isCollapsed ? <ChevronRightIcon className="w-3 h-3"/> : <ChevronLeftIcon className="w-3 h-3"/>}
                    </button>
                )}

                {/* Footer Actions */}
                <div className={`
                    border-t border-slate-200/50 dark:border-slate-700/50 
                    ${isCollapsed && !isMobile
                    ? 'px-4 py-3 flex flex-col items-center space-y-2'
                    : 'p-3 flex items-center justify-between'}
                `}>
                    <div className={`
                        flex 
                        ${isCollapsed && !isMobile
                        ? 'flex-col space-y-2 items-center w-full' // w-full 确保宽度撑开以便居中
                        : 'space-x-1'}
                    `}>
                        <LanguageSwitcher placement="top"/>
                        <DarkToggle/>
                    </div>

                    <div className={`
                        flex 
                        ${isCollapsed && !isMobile
                        ? 'flex-col space-y-2 items-center mt-2 w-full'
                        : 'space-x-1'}
                    `}>
                        <button
                            onClick={handleOpenUserSetting}
                            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-600"
                            title={t('user_settings')}
                        >
                            <Cog6ToothIcon className="w-5 h-5"/>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-slate-500 dark:text-slate-400 hover:text-red-600"
                            title="退出登录"
                        >
                            <ArrowRightOnRectangleIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm z-30"
                    onClick={toggleSidebar}
                />
            )}

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