import { Scissors, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";
import { formatName, getDisplayName } from "../utils/formatters";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

const statusConfig = {
  pending: {
    label: "Pendente",
    badgeClass: "badge-yellow",
    barClass: "appointment-color-pending",
  },
  confirmed: {
    label: "Confirmado",
    badgeClass: "badge-green",
    barClass: "appointment-color-confirmed",
  },
  canceled: {
    label: "Cancelado",
    badgeClass: "badge-muted",
    barClass: "appointment-color-canceled",
  },
};

export default function Dashboard() {
  const { barberShop, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const displayName = getDisplayName({ user, barberShop });

  useEffect(() => {
    api
      .get("/appointments/", { params: { date: todayIso() } })
      .then((response) => setAppointments(Array.isArray(response.data) ? response.data : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, []);

  const activeAppointments = appointments.filter((appointment) => appointment.status !== "canceled");

  const stats = useMemo(() => {
    const confirmed = appointments.filter((appointment) => appointment.status === "confirmed").length;
    const pending = appointments.filter((appointment) => appointment.status === "pending").length;
    const total = activeAppointments.length;
    const occupancy = total ? Math.min(Math.round((total / 4) * 100), 100) : 0;
    const confirmationRate = total ? Math.round((confirmed / total) * 100) : 0;

    return { confirmed, confirmationRate, occupancy, pending, total };
  }, [appointments, activeAppointments.length]);

  const metrics = [
    {
      label: "Agendamentos",
      value: loading ? "..." : String(stats.total),
      className: "metric-neutral",
      footer: stats.total ? "Agenda atualizada em tempo real" : "Nenhum horario hoje",
    },
    {
      label: "Confirmados",
      value: loading ? "..." : String(stats.confirmed),
      className: "metric-green",
      footer: `Taxa de ${stats.confirmationRate}%`,
    },
    {
      label: "Pendentes",
      value: loading ? "..." : String(stats.pending),
      className: "metric-yellow",
      footer: stats.pending ? "Aguardando confirmacao" : "Nada pendente",
    },
    {
      label: "Ocupacao",
      value: loading ? "..." : `${stats.occupancy}%`,
      className: "metric-blue",
      footer: stats.occupancy ? "Dia com movimento" : "Agenda livre",
    },
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading">
        <h2>{displayName}</h2>
        <p>{formatDate()}</p>
      </section>

      <section className="metric-grid" aria-label="Metricas do dia">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong className={metric.className}>{metric.value}</strong>
            <p>{metric.footer}</p>
          </article>
        ))}
      </section>

      <section className="appointments-section">
        <div className="appointments-header">
          <div>
            <h3>Proximos horarios</h3>
            <p>
              {loading
                ? "Carregando agenda de hoje"
                : stats.total
                  ? `Hoje voce tem ${stats.total} cliente${stats.total > 1 ? "s" : ""} agendado${stats.total > 1 ? "s" : ""}`
                  : "Nenhum cliente agendado para hoje"}
            </p>
          </div>
          <span>{loading ? "..." : `${stats.total} hoje`}</span>
        </div>

        {loading ? (
          <div className="empty-state">Carregando horarios...</div>
        ) : activeAppointments.length === 0 ? (
          <div className="empty-state">Nenhum horario ativo para hoje.</div>
        ) : (
          <div className="premium-appointment-list">
            {activeAppointments.map((appointment) => {
              const config = statusConfig[appointment.status] || statusConfig.pending;
              return (
                <article className="premium-appointment-card" key={appointment.id}>
                  <span className={`appointment-color-bar ${config.barClass}`} />
                  <div className="appointment-service-icon">
                    <Scissors size={20} strokeWidth={2} />
                  </div>
                  <div className="appointment-main">
                    <h4>Atendimento</h4>
                    <p>
                      <User size={13} strokeWidth={2} />
                      {formatName(appointment.client_name)}
                    </p>
                  </div>
                  <div className="appointment-meta">
                    <strong>{appointment.time.slice(0, 5)}</strong>
                    <small>Horario agendado</small>
                    <span className={`appointment-status ${config.badgeClass}`}>{config.label}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
