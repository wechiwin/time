import { Navigate, Outlet, useLocation } from 'react-router-dom';

const PrivateRoute = () => {
    const token = localStorage.getItem('access_token');
    const location = useLocation();

    if (!token) {
        // 如果没有 Token，重定向到登录页，并记录当前想去的页面(state.from)
        // 登录成功后可以跳回这里（可选优化）
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 如果有 Token，渲染子路由（如 Dashboard）
    return <Outlet />;
};

export default PrivateRoute;