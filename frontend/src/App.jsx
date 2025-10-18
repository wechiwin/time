import {Routes, Route, Navigate} from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import FundPage from './pages/HoldingPage';
import TradePage from './pages/TransactionPage';
import NetValuePage from './pages/NetValuePage';
import {ToastProvider} from './components/toast/ToastContext';

export default function App() {
    return (
        <ToastProvider>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="funds" element={<FundPage />} />
                    <Route path="trades" element={<TradePage />} />
                    <Route path="netvalue" element={<NetValuePage />} />
                </Route>
            </Routes>
        </ToastProvider>
    );
}