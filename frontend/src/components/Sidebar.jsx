import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, LayoutDashboard, LogOut, Scissors, Settings, Users } from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Scissors size={20} />
        </span>
        <div>
          <strong>BarberFlow</strong>
          <small>Agenda SaaS</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
          <NavLink key={item.to} to={item.to} className="nav-link">
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </NavLink>
          );
        })}
      </nav>

      <button className="logout-button" type="button" onClick={handleLogout}>
        <LogOut size={17} aria-hidden="true" />
        Sair
      </button>
    </aside>
  );
}
