import { Bell, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getDisplayName } from "../utils/formatters";

export default function Header() {
  const { barberShop, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const displayName = getDisplayName({ user, barberShop });

  function openNewAppointment() {
    const requestId = Date.now();
    if (location.pathname === "/agenda") {
      window.dispatchEvent(new CustomEvent("barberflow:open-appointment-modal"));
      return;
    }

    navigate("/agenda", {
      state: {
        openAppointmentModal: requestId,
      },
    });
  }

  function showNotifications() {
    toast.info("Voce nao tem novas notificacoes.");
  }

  return (
    <header className="topbar">
      <div>
        <p className="topbar-eyebrow">Ol&aacute;</p>
        <h1>{displayName}</h1>
      </div>

      <div className="topbar-actions">
        <button className="notification-button" type="button" aria-label="Notificacoes" onClick={showNotifications}>
          <Bell size={17} strokeWidth={2} />
          <span aria-hidden="true" />
        </button>
        <button className="topbar-primary" type="button" onClick={openNewAppointment}>
          <Plus size={16} strokeWidth={2.2} />
          Novo agendamento
        </button>
      </div>
    </header>
  );
}
