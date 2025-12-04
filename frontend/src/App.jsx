import {Routes, Route, Navigate} from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HoldingPage from './pages/HoldingPage';
import TradePage from './pages/TradePage';
import NavHistoryPage from './pages/NavHistoryPage';
import {ToastProvider} from './components/toast/ToastContext';
import NavHistoryDetailPage from "./pages/detail/NavHistoryDetailPage";
import TradeHistoryDetailPage from "./pages/detail/TradeHistoryDetailPage";
import AlertPage from "./pages/AlertPage";

export default function App() {
    return (
        <ToastProvider>
            <Routes>
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
            </Routes>
        </ToastProvider>
    );
}