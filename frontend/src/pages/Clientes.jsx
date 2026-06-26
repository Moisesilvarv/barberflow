import { useEffect, useMemo, useState } from "react";

import api from "../services/api";
import { formatName } from "../utils/formatters";
import { formatPhone } from "../utils/phone";

export default function Clientes() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/appointments/")
      .then((response) => setAppointments(Array.isArray(response.data) ? response.data : []))
      .catch(() => setAppointments([]))
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
          <div className="empty-state">Os clientes aparecem aqui apos os primeiros agendamentos.</div>
        ) : (
          <div className="data-table">
            <div className="table-row table-head">
              <span>Nome</span>
              <span>Telefone</span>
              <span>Agendamentos</span>
              <span>Ultimo horario</span>
            </div>
            {clients.map((client) => (
              <div className="table-row" key={client.phone}>
                <strong>{formatName(client.name)}</strong>
                <span>{formatPhone(client.phone)}</span>
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
