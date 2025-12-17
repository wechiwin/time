import {Navigate, Route, Routes} from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HoldingPage from './pages/HoldingPage';
import TradePage from './pages/TradePage';
import NavHistoryPage from './pages/NavHistoryPage';
import {ToastProvider} from './components/context/ToastContext';
import NavHistoryDetailPage from "./pages/detail/NavHistoryDetailPage";
import TradeHistoryDetailPage from "./pages/detail/TradeHistoryDetailPage";
import AlertPage from "./pages/AlertPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/common/PrivateRoute";
import RegisterPage from "./pages/RegisterPage";
import {DarkModeProvider} from "./components/context/DarkModeContext";

export default function App() {
    return (
        <DarkModeProvider>
            <ToastProvider>
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
                            {/* <Route path="/holding/:ho_code" element={<NavHistoryDetailPage/>}/> */}
                            <Route path="/trade/:ho_code" element={<TradeHistoryDetailPage/>}/>
                            <Route path="/nav_history/:ho_code" element={<NavHistoryDetailPage/>}/>
                        </Route>
                    </Route>
                    {/* 任何其他未匹配的路径重定向到 Dashboard 或 404 */}
                    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
                </Routes>
            </ToastProvider>
        </DarkModeProvider>
    );
}