import {Navigate, Outlet} from 'react-router-dom';
import {useContext} from "react";
import {AuthContext} from "../context/AuthContext";
import Spinner from "../ui/Spinner";
import {useTranslation} from "react-i18next";

export default function PrivateRoute() {
    const {isAuthenticated, isLoading} = useContext(AuthContext);
    const {t} = useTranslation()

    if (isLoading) {
        // 在认证状态检查期间，显示全屏加载指示器
        return <Spinner label={t('msg_verifying_identity')}/>;
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }
    return <Outlet/>;
}