import { Navigate, Outlet, useLocation } from 'react-router-dom';
import SecureTokenStorage from "../../utils/tokenStorage";
import { useEffect, useState } from 'react';

export default function PrivateRoute() {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(() => SecureTokenStorage.isAuthenticated());

    // 监听认证状态变化
    useEffect(() => {
        const checkAuth = () => {
            setIsAuthenticated(SecureTokenStorage.isAuthenticated());
        };
        checkAuth();
    }, [location]);

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
