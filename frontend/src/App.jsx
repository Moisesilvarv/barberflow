import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Header from "./components/Header.jsx";
import PlatformPrivateRoute from "./components/PlatformPrivateRoute.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Agenda from "./pages/Agenda.jsx";
import Clientes from "./pages/Clientes.jsx";
import Configuracoes from "./pages/Configuracoes.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import PlatformBarbershopDetail from "./pages/PlatformBarbershopDetail.jsx";
import PlatformBarbershops from "./pages/PlatformBarbershops.jsx";
import PlatformDashboard from "./pages/PlatformDashboard.jsx";
import PlatformLogin from "./pages/PlatformLogin.jsx";
import PublicBooking from "./pages/PublicBooking.jsx";

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Header />
        <section className="content-area">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/public/:barbershop_id" element={<PublicBooking />} />
      <Route element={<PlatformPrivateRoute />}>
        <Route path="/platform/dashboard" element={<PlatformDashboard />} />
        <Route path="/platform/barbershops" element={<PlatformBarbershops />} />
        <Route path="/platform/barbershops/:id" element={<PlatformBarbershopDetail />} />
      </Route>
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
