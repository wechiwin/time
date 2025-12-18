import {Navigate, Outlet} from 'react-router-dom';
import SecureTokenStorage from "../../utils/tokenStorage";

export default function PrivateRoute() {
    const isAuthenticated = SecureTokenStorage.getAccessToken() !== null;

    return isAuthenticated ? <Outlet/> : <Navigate to="/login" replace/>;
}