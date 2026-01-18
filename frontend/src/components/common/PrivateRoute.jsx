import {Navigate, Outlet} from 'react-router-dom';
import {useContext} from "react";
import {AuthContext} from "../context/AuthContext";
import Spinner from "../ui/Spinner";

export default function PrivateRoute() {
    const {isAuthenticated, isLoading} = useContext(AuthContext);

    if (isLoading) {
        // 在认证状态检查期间，显示全屏加载指示器
        return <Spinner label="正在验证身份..."/>; // 可以自定义加载文本
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }
    return <Outlet/>;
}