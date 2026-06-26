import { CalendarDays, LayoutDashboard, LogOut, Scissors, Settings, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getDisplayName } from "../utils/formatters";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configura\u00e7\u00f5es", icon: Settings },
];

function getInitials(nameOrEmail) {
  const value = nameOrEmail || "BF";
  const parts = value
    .replace(/@.*/, "")
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Sidebar() {
  const { barberShop, logout, user } = useAuth();
  const displayName = getDisplayName({ user, barberShop });
  const email = user?.email || barberShop?.email || "";

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Scissors size={18} strokeWidth={2} />
        </span>
        <div>
          <strong>BarberFlow</strong>
          <small>Painel de controle</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navegacao principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="nav-link">
              <Icon size={17} strokeWidth={2} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-profile" aria-label="Perfil logado">
          <span className="sidebar-avatar">{getInitials(displayName)}</span>
          <span>
            <strong>{displayName}</strong>
            {email && <small>{email}</small>}
          </span>
        </div>
        <button className="sidebar-logout" type="button" onClick={logout}>
          <LogOut size={15} strokeWidth={2} aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
}
