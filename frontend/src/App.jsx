import {Routes, Route, Navigate} from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HoldingPage from './pages/HoldingPage';
import TradePage from './pages/TransactionPage';
import NetValuePage from './pages/NetValuePage';
import {ToastProvider} from './components/toast/ToastContext';
import HoldingDetailPage from "./pages/HoldingDetailPage";

export default function App() {
    return (
        <ToastProvider>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="holding" element={<HoldingPage />} />
                    <Route path="transaction" element={<TradePage />} />
                    <Route path="net_value" element={<NetValuePage />} />
                    <Route path="/holding/:fund_code" element={<HoldingDetailPage />} />
                </Route>
            </Routes>
        </ToastProvider>
    );
}