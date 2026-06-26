import { Navigate, Outlet } from "react-router-dom";

import { usePlatformAuth } from "../context/PlatformAuthContext.jsx";

export default function PlatformPrivateRoute() {
  const { isPlatformAuthenticated, loading } = usePlatformAuth();

  if (loading) {
    return <div className="platform-screen-loader">Validando acesso administrativo...</div>;
  }

  return isPlatformAuthenticated ? <Outlet /> : <Navigate to="/platform/login" replace />;
}
