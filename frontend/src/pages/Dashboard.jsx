import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";

const statusLabels = {
  pending: "Pendentes",
  confirmed: "Confirmados",
  canceled: "Cancelados",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/appointments/", { params: { date: todayIso() } })
      .then((response) => setAppointments(response.data))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    return appointments.reduce(
      (totals, appointment) => {
        totals.total += 1;
        totals[appointment.status] = (totals[appointment.status] || 0) + 1;
        return totals;
      },
      { total: 0, pending: 0, confirmed: 0, canceled: 0 },
    );
  }, [appointments]);

  const nextAppointments = appointments
    .filter((appointment) => appointment.status !== "canceled")
    .slice(0, 5);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Hoje</p>
          <h2>Resumo da agenda</h2>
        </div>
        <Link className="primary-link" to="/agenda">
          Abrir agenda
        </Link>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Total do dia</span>
          <strong>{loading ? "..." : stats.total}</strong>
        </article>
        {Object.entries(statusLabels).map(([status, label]) => (
          <article className="metric-card" key={status}>
            <span>{label}</span>
            <strong>{loading ? "..." : stats[status]}</strong>
          </article>
        ))}
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Próximos horários</h3>
          <span>{todayIso()}</span>
        </div>
        {nextAppointments.length === 0 ? (
          <div className="empty-state">Nenhum horário ativo para hoje.</div>
        ) : (
          <div className="compact-list">
            {nextAppointments.map((appointment) => (
              <div className="compact-row" key={appointment.id}>
                <strong>{appointment.time.slice(0, 5)}</strong>
                <span>{appointment.client_name}</span>
                <em>{appointment.status}</em>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
