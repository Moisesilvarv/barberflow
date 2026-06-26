import { CalendarDays, ChevronLeft, ChevronRight, Clock, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errors";
import { formatName, getDisplayName } from "../utils/formatters";
import { formatPhone, isValidPhone } from "../utils/phone";

const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmado",
  canceled: "Cancelado",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function displayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function shiftDate(isoDate, amount) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day);
  nextDate.setDate(nextDate.getDate() + amount);
  return toIsoDate(nextDate);
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

function sortAppointments(appointments) {
  return [...appointments].sort((first, second) => String(first.time).localeCompare(String(second.time)));
}

export default function Agenda() {
  const { barberShop, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const dateInputRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [date, setDate] = useState(todayIso());
  const [form, setForm] = useState(() => buildEmptyForm());
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadAppointments(selectedDate = date) {
    setLoading(true);
    try {
      const response = await api.get("/appointments/", { params: { date: selectedDate } });
      setAppointments(Array.isArray(response.data) ? response.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments(date);
  }, [date]);

  const sortedAppointments = useMemo(() => sortAppointments(appointments), [appointments]);
  const activeAppointments = sortedAppointments.filter((appointment) => appointment.status !== "canceled");
  const confirmedCount = sortedAppointments.filter((appointment) => appointment.status === "confirmed").length;
  const nextAppointment = activeAppointments[0];
  const displayName = getDisplayName({ user, barberShop });

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "client_phone" ? formatPhone(value) : value,
    }));
  }

  function openCreateModal() {
    setEditing(null);
    setForm(buildEmptyForm(date));
    setModalOpen(true);
  }

  useEffect(() => {
    function handleOpenAppointmentModal() {
      openCreateModal();
    }

    window.addEventListener("barberflow:open-appointment-modal", handleOpenAppointmentModal);
    return () => window.removeEventListener("barberflow:open-appointment-modal", handleOpenAppointmentModal);
  }, [date]);

  useEffect(() => {
    if (!location.state?.openAppointmentModal) {
      return;
    }

    openCreateModal();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state?.openAppointmentModal]);

  function openEditModal(appointment) {
    setEditing(appointment);
    setForm({
      client_name: appointment.client_name,
      client_phone: formatPhone(appointment.client_phone),
      date: appointment.date,
      time: appointment.time.slice(0, 5),
      status: appointment.status,
    });
    setModalOpen(true);
  }

  async function submitAppointment(event) {
    event.preventDefault();

    if (!isValidPhone(form.client_phone)) {
      toast.error("Telefone invalido.");
      return;
    }

    const confirmed = window.confirm(editing ? "Salvar alteracoes deste agendamento?" : "Criar este agendamento?");
    if (!confirmed) return;

    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/appointments/${editing.id}/`, form);
        toast.success("Agendamento atualizado com sucesso.");
      } else {
        await api.post("/appointments/", form);
        toast.success("Agendamento realizado com sucesso.");
      }
      setModalOpen(false);
      if (form.date !== date) {
        setDate(form.date);
      } else {
        await loadAppointments(date);
      }
    } catch (requestError) {
      toast.error(getFriendlyErrorMessage(requestError, "Nao foi possivel salvar o agendamento."));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAppointment(appointment) {
    const confirmed = window.confirm(`Confirmar o horario de ${formatName(appointment.client_name)}?`);
    if (!confirmed) return;

    try {
      await api.patch(`/appointments/${appointment.id}/`, { status: "confirmed" });
      await loadAppointments(date);
      toast.success("Agendamento confirmado com sucesso.");
    } catch (requestError) {
      toast.error(getFriendlyErrorMessage(requestError, "Nao foi possivel confirmar o agendamento."));
    }
  }

  async function cancelAppointment(appointment) {
    const confirmed = window.confirm(`Cancelar o horario de ${formatName(appointment.client_name)}?`);
    if (!confirmed) return;

    try {
      await api.delete(`/appointments/${appointment.id}/`);
      await loadAppointments(date);
      toast.success("Agendamento cancelado com sucesso.");
    } catch (requestError) {
      toast.error(getFriendlyErrorMessage(requestError, "Nao foi possivel cancelar o agendamento."));
    }
  }

  return (
    <div className="agenda-page">
      <header className="agenda-hero">
        <div>
          <p>Ol&aacute; &middot; {displayName}</p>
          <h1>Hor&aacute;rios da barbearia</h1>
        </div>
      </header>

      <div className="agenda-date-row">
        <label className="agenda-date-control" onClick={openDatePicker}>
          <CalendarDays size={16} strokeWidth={2} />
          <span>{displayDate(date)}</span>
          <input
            ref={dateInputRef}
            aria-label="Filtrar por data"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="button" className="agenda-icon-button" aria-label="Dia anterior" onClick={() => setDate(shiftDate(date, -1))}>
          <ChevronLeft size={17} strokeWidth={2.1} />
        </button>
        <button type="button" className="agenda-icon-button" aria-label="Proximo dia" onClick={() => setDate(shiftDate(date, 1))}>
          <ChevronRight size={17} strokeWidth={2.1} />
        </button>
      </div>

      <section className="agenda-summary-grid">
        <article className="agenda-summary-card">
          <span>Total hoje</span>
          <strong>{activeAppointments.length}</strong>
          <small>{activeAppointments.length === 1 ? "agendamento" : "agendamentos"}</small>
        </article>
        <article className="agenda-summary-card">
          <span>Confirmados</span>
          <strong>{confirmedCount}</strong>
          <small>de {activeAppointments.length} total</small>
        </article>
        <article className="agenda-summary-card">
          <span>Pr&oacute;ximo hor&aacute;rio</span>
          <strong>{nextAppointment ? nextAppointment.time.slice(0, 5) : "--:--"}</strong>
          <small>{nextAppointment ? formatName(nextAppointment.client_name) : "Nenhum"}</small>
        </article>
      </section>

      <section className="agenda-day-section">
        <h2>Agenda do dia</h2>

        {loading ? (
          <div className="agenda-empty-row">
            <Clock size={18} strokeWidth={2} />
            Carregando agendamentos...
          </div>
        ) : activeAppointments.length === 0 ? (
          <div className="agenda-empty-row">
            <Clock size={18} strokeWidth={2} />
            Nenhum agendamento para esta data
          </div>
        ) : (
          <div className="agenda-list">
            {activeAppointments.map((appointment) => (
              <article className="agenda-row-card" key={appointment.id}>
                <div className="agenda-row-time">
                  <strong>{appointment.time?.slice(0, 5)}</strong>
                  <span>{appointment.time?.slice(0, 5) < "12:00" ? "manha" : "tarde"}</span>
                </div>
                <div className="agenda-row-client">
                  <strong>{formatName(appointment.client_name)}</strong>
                  <span>
                    <Phone size={14} strokeWidth={1.9} />
                    {formatPhone(appointment.client_phone)}
                  </span>
                </div>
                <div className="agenda-row-actions">
                  <span className={`agenda-status agenda-status-${appointment.status}`}>
                    {statusLabels[appointment.status] || appointment.status}
                  </span>
                  <button type="button" className="agenda-action-button" onClick={() => openEditModal(appointment)}>
                    Editar
                  </button>
                  {appointment.status !== "confirmed" && (
                    <button type="button" className="agenda-action-button" onClick={() => confirmAppointment(appointment)}>
                      Confirmar
                    </button>
                  )}
                  <button type="button" className="agenda-danger-button" onClick={() => cancelAppointment(appointment)}>
                    Cancelar
                  </button>
                </div>
              </article>
            ))}
            <div className="agenda-empty-row">
              <Clock size={18} strokeWidth={2} />
              Nenhum outro agendamento para hoje
            </div>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={submitAppointment}>
            <div className="panel-header">
              <h3>{editing ? "Editar agendamento" : "Novo agendamento"}</h3>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)}>
                x
              </button>
            </div>

            <label>
              Cliente
              <input name="client_name" onChange={updateField} required value={form.client_name} />
            </label>
            <label>
              Telefone
              <input
                inputMode="numeric"
                maxLength={13}
                name="client_phone"
                onChange={updateField}
                required
                value={form.client_phone}
              />
            </label>
            <div className="form-grid">
              <label>
                Data
                <input name="date" onChange={updateField} required type="date" value={form.date} />
              </label>
              <label>
                Hor&aacute;rio
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
