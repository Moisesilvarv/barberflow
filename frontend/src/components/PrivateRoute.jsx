import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getAccessToken } from "../services/auth";

export default function PrivateRoute() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="screen-loader">Carregando painel...</div>;
  }

  return getAccessToken() ? <Outlet /> : <Navigate to="/login" replace />;
}
