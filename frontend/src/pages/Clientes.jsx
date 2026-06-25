import { useEffect, useMemo, useState } from "react";

import api from "../services/api";

export default function Clientes() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/appointments/")
      .then((response) => setAppointments(response.data))
      .finally(() => setLoading(false));
  }, []);

  const clients = useMemo(() => {
    const clientsByPhone = new Map();

    appointments.forEach((appointment) => {
      const existing = clientsByPhone.get(appointment.client_phone) || {
        name: appointment.client_name,
        phone: appointment.client_phone,
        total: 0,
        lastDate: appointment.date,
      };

      existing.total += 1;
      if (appointment.date > existing.lastDate) {
        existing.lastDate = appointment.date;
      }

      clientsByPhone.set(appointment.client_phone, existing);
    });

    return Array.from(clientsByPhone.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Base da barbearia</h2>
        </div>
      </div>

      <section className="panel">
        {loading ? (
          <div className="empty-state">Carregando clientes...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">Os clientes aparecem aqui após os primeiros agendamentos.</div>
        ) : (
          <div className="data-table">
            <div className="table-row table-head">
              <span>Nome</span>
              <span>Telefone</span>
              <span>Agendamentos</span>
              <span>Último horário</span>
            </div>
            {clients.map((client) => (
              <div className="table-row" key={client.phone}>
                <strong>{client.name}</strong>
                <span>{client.phone}</span>
                <span>{client.total}</span>
                <span>{client.lastDate}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
