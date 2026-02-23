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
import NotFoundPage from "./pages/NotFoundPage";
import PrivateRoute from "./components/common/PrivateRoute";
import RegisterPage from "./pages/RegisterPage";
import {DarkModeProvider} from "./components/context/DarkModeContext";
import {ColorProvider} from "./components/context/ColorContext";
import SecureTokenStorage from "./utils/tokenStorage";
import {useEffect, useState} from "react";
import {AuthProvider} from "./components/context/AuthContext";
import {AUTH_EXPIRED_EVENT} from "./api/client";
import AsyncTaskLogPage from "./pages/AsyncTaskLogPage";
import {EnumProvider} from "./contexts/EnumContext";

// 必须放在 Router 和 ToastProvider 内部才能使用 hooks
function AuthWatcher() {
    const navigate = useNavigate();
    const {showErrorToast} = useToast();
    const [hasRedirected, setHasRedirected] = useState(false); // 👈 新增
    useEffect(() => {
        const handleExpired = () => {
            if (hasRedirected) return; // 👈 防重
            setHasRedirected(true);
            SecureTokenStorage.clearTokens();
            // showErrorToast('登录已过期，请重新登录');
            navigate('/login', {replace: true});
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    }, [navigate, showErrorToast, hasRedirected]);
    return null;
}

export default function App() {
    return (
        <DarkModeProvider>
            <ToastProvider>
                <AuthProvider>
                    <EnumProvider>
                        <ColorProvider>
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
                                        <Route path="historical_trend" element={<NavHistoryPage/>}/>
                                        <Route path="/trade/:ho_id" element={<TradeHistoryDetailPage/>}/>
                                        <Route path="/historical_trend/:ho_id" element={<NavHistoryDetailPage/>}/>
                                        <Route path="/task_logs" element={<AsyncTaskLogPage/>}/>
                                    </Route>
                                </Route>
                                {/* 404 页面 */}
                                <Route path="*" element={<NotFoundPage/>}/>
                            </Routes>
                        </ColorProvider>
                    </EnumProvider>
                </AuthProvider>
            </ToastProvider>
        </DarkModeProvider>
    );
}