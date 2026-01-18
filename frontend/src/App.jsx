import {Navigate, Route, Routes, useNavigate} from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HoldingPage from './pages/HoldingPage';
import TradePage from './pages/TradePage';
import NavHistoryPage from './pages/NavHistoryPage';
import {ToastProvider, useToast} from './components/context/ToastContext';
import NavHistoryDetailPage from "./pages/detail/NavHistoryDetailPage";
import TradeHistoryDetailPage from "./pages/detail/TradeHistoryDetailPage";
import AlertPage from "./pages/AlertPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/common/PrivateRoute";
import RegisterPage from "./pages/RegisterPage";
import {DarkModeProvider} from "./components/context/DarkModeContext";
import SecureTokenStorage from "./utils/tokenStorage";
import {useEffect} from "react";
import {AUTH_EXPIRED_EVENT} from './hooks/useApi';
import {AuthProvider} from "./components/context/AuthContext";

// === 新增：全局认证监听组件 ===
// 必须放在 Router 和 ToastProvider 内部才能使用 hooks
function AuthWatcher() {
    const navigate = useNavigate();
    const {showErrorToast} = useToast();

    useEffect(() => {
        const handleExpired = () => {
            console.log("AuthWatcher: 检测到会话过期");

            // 1. 清理 Token
            SecureTokenStorage.clearTokens();

            // 2. 统一提示 (只提示一次)
            showErrorToast('登录已过期，请重新登录');

            // 3. 跳转登录页
            navigate('/login', {replace: true});
        };

        window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    }, [navigate, showErrorToast]);

    return null; // 这个组件不渲染任何 UI
}

export default function App() {
    return (
        <DarkModeProvider>
            <ToastProvider>
                <AuthProvider>
                    <AuthWatcher/>

                    <Routes>
                        {/* 登录路由 (公开) */}
                        <Route path="/login" element={<LoginPage/>}/>
                        <Route path="/register" element={<RegisterPage/>}/>

                        {/* 受保护路由组 */}
                        <Route element={<PrivateRoute/>}>
                            <Route path="/" element={<Layout/>}>
                                <Route index element={<Navigate to="/dashboard"/>}/>
                                <Route path="dashboard" element={<Dashboard/>}/>
                                <Route path="holding" element={<HoldingPage/>}/>
                                <Route path="trade" element={<TradePage/>}/>
                                <Route path="alert" element={<AlertPage/>}/>
                                <Route path="nav_history" element={<NavHistoryPage/>}/>
                                <Route path="/trade/:ho_id" element={<TradeHistoryDetailPage/>}/>
                                <Route path="/nav_history/:ho_id" element={<NavHistoryDetailPage/>}/>
                                {/* <Route path="/holding_snapshot" element={<HoldingSnapshotPage/>}/> */}
                            </Route>
                        </Route>
                        {/* 任何其他未匹配的路径重定向到 Dashboard 或 404 */}
                        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </DarkModeProvider>
    );
}