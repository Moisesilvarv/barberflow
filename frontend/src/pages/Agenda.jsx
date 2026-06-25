import { useEffect, useState } from "react";

import AppointmentCard from "../components/AppointmentCard.jsx";
import api from "../services/api";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function nextDefaultSlot(baseDate = new Date()) {
  const date = new Date(baseDate);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const opening = 9 * 60;
  const closing = 18 * 60;

  if (minutes >= closing) {
    date.setDate(date.getDate() + 1);
    return { date: toIsoDate(date), time: "09:00" };
  }

  if (minutes < opening) {
    return { date: toIsoDate(date), time: "09:00" };
  }

  const nextSlot = Math.ceil(minutes / 30) * 30;
  return {
    date: toIsoDate(date),
    time: `${String(Math.floor(nextSlot / 60)).padStart(2, "0")}:${String(nextSlot % 60).padStart(2, "0")}`,
  };
}

function buildEmptyForm(dateOverride) {
  const today = todayIso();
  const slot =
    dateOverride && dateOverride !== today
      ? { date: dateOverride, time: "09:00" }
      : nextDefaultSlot();
  return {
    client_name: "",
    client_phone: "",
    date: slot.date,
    time: slot.time,
    status: "pending",
  };
}

export default function Agenda() {
  const [appointments, setAppointments] = useState([]);
  const [date, setDate] = useState(todayIso());
  const [form, setForm] = useState(() => buildEmptyForm());
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadAppointments(selectedDate = date) {
    setLoading(true);
    const response = await api.get("/appointments/", { params: { date: selectedDate } });
    setAppointments(response.data);
    setLoading(false);
  }

  useEffect(() => {
    loadAppointments(date);
  }, [date]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function openCreateModal() {
    setEditing(null);
    setForm(buildEmptyForm(date));
    setError("");
    setModalOpen(true);
  }

  function openEditModal(appointment) {
    setEditing(appointment);
    setForm({
      client_name: appointment.client_name,
      client_phone: appointment.client_phone,
      date: appointment.date,
      time: appointment.time.slice(0, 5),
      status: appointment.status,
    });
    setError("");
    setModalOpen(true);
  }

  async function submitAppointment(event) {
    event.preventDefault();
    setError("");

    const confirmed = window.confirm(
      editing ? "Salvar alterações deste agendamento?" : "Criar este agendamento?",
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/appointments/${editing.id}/`, form);
      } else {
        await api.post("/appointments/", form);
      }
      setModalOpen(false);
      if (form.date !== date) {
        setDate(form.date);
      } else {
        await loadAppointments(date);
      }
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || requestError.response?.data?.non_field_errors?.[0];
      setError(detail || "Não foi possível salvar o agendamento.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAppointment(appointment) {
    const confirmed = window.confirm(`Confirmar o horário de ${appointment.client_name}?`);
    if (!confirmed) {
      return;
    }

    await api.patch(`/appointments/${appointment.id}/`, { status: "confirmed" });
    await loadAppointments(date);
  }

  async function cancelAppointment(appointment) {
    const confirmed = window.confirm(`Cancelar o horário de ${appointment.client_name}?`);
    if (!confirmed) {
      return;
    }

    await api.delete(`/appointments/${appointment.id}/`);
    await loadAppointments(date);
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>Horários da barbearia</h2>
        </div>
        <button className="primary-button compact" type="button" onClick={openCreateModal}>
          Novo agendamento
        </button>
      </div>

      <section className="toolbar">
        <label>
          Filtrar por data
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </section>

      {loading ? (
        <div className="empty-state">Carregando agendamentos...</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">Nenhum agendamento para esta data.</div>
      ) : (
        <div className="appointment-list">
          {appointments.map((appointment) => (
            <AppointmentCard
              appointment={appointment}
              key={appointment.id}
              onCancel={cancelAppointment}
              onConfirm={confirmAppointment}
              onEdit={openEditModal}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={submitAppointment}>
            <div className="panel-header">
              <h3>{editing ? "Editar agendamento" : "Novo agendamento"}</h3>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)}>
                x
              </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            <label>
              Cliente
              <input name="client_name" onChange={updateField} required value={form.client_name} />
            </label>
            <label>
              Telefone
              <input name="client_phone" onChange={updateField} required value={form.client_phone} />
            </label>
            <div className="form-grid">
              <label>
                Data
                <input name="date" onChange={updateField} required type="date" value={form.date} />
              </label>
              <label>
                Horário
                <input name="time" onChange={updateField} required type="time" step="1800" value={form.time} />
              </label>
            </div>
            <label>
              Status
              <select name="status" onChange={updateField} value={form.status}>
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="canceled">Cancelado</option>
              </select>
            </label>
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
