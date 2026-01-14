import {Navigate, Outlet} from 'react-router-dom';
import SecureTokenStorage from "../../utils/tokenStorage";

export default function PrivateRoute() {
    return SecureTokenStorage.isAuthenticated ? <Outlet/> : <Navigate to="/login" replace/>;
}