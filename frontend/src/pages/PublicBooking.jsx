import { CalendarDays, Check, ChevronDown, Clock, Info, Lock, Scissors, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useToast } from "../context/ToastContext.jsx";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errors";
import { formatName } from "../utils/formatters";
import { formatPhone, isValidPhone } from "../utils/phone";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultBookingDate() {
  const date = new Date();
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function formatShortDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatLongDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function PublicBooking() {
  const { barbershop_id } = useParams();
  const toast = useToast();
  const [date, setDate] = useState(defaultBookingDate);
  const [availability, setAvailability] = useState({ available: [], occupied: [] });
  const [shopName, setShopName] = useState("Barbearia");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState({ client_name: "", client_phone: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const allSlots = useMemo(() => {
    return [...availability.available, ...availability.occupied].sort();
  }, [availability]);

  const formattedShopName = formatName(shopName);
  const longDate = formatLongDate(date);

  useEffect(() => {
    setLoading(true);
    setSelectedTime("");

    api
      .get(`/public/${barbershop_id}/availability/`, { params: { date } })
      .then((response) => {
        setAvailability({
          available: response.data.available || [],
          occupied: response.data.occupied || [],
        });
        setShopName(response.data.barber_shop_name || "Barbearia");
      })
      .catch((requestError) => {
        setAvailability({ available: [], occupied: [] });
        toast.error(getFriendlyErrorMessage(requestError, "Nao foi possivel carregar os horarios."));
      })
      .finally(() => setLoading(false));
  }, [barbershop_id, date, toast]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "client_phone" ? formatPhone(value) : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedTime) {
      toast.error("Escolha um horario disponivel.");
      return;
    }

    if (!isValidPhone(form.client_phone)) {
      toast.error("Telefone invalido.");
      return;
    }

    const confirmed = window.confirm(`Agendar ${formatLongDate(date)} as ${selectedTime}?`);
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/public/appointment/", {
        barber_shop_id: barbershop_id,
        client_name: form.client_name,
        client_phone: form.client_phone,
        date,
        time: selectedTime,
      });
      toast.success("Agendamento realizado com sucesso.");
      setForm({ client_name: "", client_phone: "" });
      setSelectedTime("");
      const response = await api.get(`/public/${barbershop_id}/availability/`, { params: { date } });
      setAvailability({
        available: response.data.available || [],
        occupied: response.data.occupied || [],
      });
    } catch (requestError) {
      toast.error(getFriendlyErrorMessage(requestError, "Nao foi possivel agendar esse horario."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-page">
      <section className="public-shell">
        <header className="public-hero">
          <div className="public-hero-brand">
            <span className="public-logo">BF</span>
            <div>
              <p>Agendamento online</p>
              <h1>{formattedShopName}</h1>
              <span>Estamos prontos para te atender.</span>
            </div>
          </div>
          <span className="public-hero-icon" aria-hidden="true">
            <CalendarDays size={27} strokeWidth={2} />
          </span>
        </header>

        <div className="public-grid">
          <section className="public-panel public-schedule-panel">
            <div className="public-section-title">
              <span className="public-section-icon" aria-hidden="true">
                <CalendarDays size={23} strokeWidth={2} />
              </span>
              <div>
                <h2>Escolha uma data</h2>
                <p>Selecione o dia para ver os horarios disponiveis.</p>
              </div>
            </div>

            <label className="public-date-card">
              <span className="sr-only">Escolha uma data</span>
              <CalendarDays size={19} strokeWidth={2} />
              <strong>{formatShortDate(date)}</strong>
              <ChevronDown size={18} strokeWidth={2} />
              <input min={todayIso()} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>

            <div className="public-divider" />

            <section className="slot-section">
              <div className="public-slots-heading">
                <div>
                  <Clock size={24} strokeWidth={2} />
                  <h2>Horarios disponiveis</h2>
                </div>
                <span>{longDate}</span>
              </div>

              {loading ? (
                <div className="empty-state">Carregando horarios...</div>
              ) : allSlots.length === 0 ? (
                <div className="empty-state">Nenhum horario disponivel para esta data.</div>
              ) : (
                <div className="slot-grid" aria-label="Horarios disponiveis">
                  {allSlots.map((slot) => {
                    const occupied = availability.occupied.includes(slot);
                    const selected = selectedTime === slot;
                    return (
                      <button
                        className={`slot-button ${occupied ? "is-occupied" : ""} ${selected ? "is-selected" : ""}`}
                        disabled={occupied}
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        type="button"
                        aria-pressed={selected}
                      >
                        <span>{slot}</span>
                        {selected && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="public-info-card">
              <Info size={19} strokeWidth={2.2} />
              <div>
                <strong>Importante</strong>
                <p>Os horarios em cinza nao estao disponiveis para esta data.</p>
              </div>
            </aside>
          </section>

          <form className="public-panel booking-form" onSubmit={handleSubmit}>
            <div className="public-section-title">
              <span className="public-section-icon" aria-hidden="true">
                <UserRound size={24} strokeWidth={2} />
              </span>
              <div>
                <h2>Confirmar horario</h2>
                <p>Preencha seus dados e confirme o horario.</p>
              </div>
            </div>

            <label>
              Nome
              <input
                name="client_name"
                onChange={updateField}
                placeholder="Digite seu nome completo"
                required
                value={form.client_name}
              />
            </label>
            <label>
              Telefone
              <input
                inputMode="numeric"
                maxLength={13}
                name="client_phone"
                onChange={updateField}
                placeholder="(11) 99999-9999"
                required
                value={form.client_phone}
              />
            </label>

            <div className="selected-summary-block">
              <span>Horario selecionado</span>
              <div className="selected-time-card">
                <span className="selected-time-icon" aria-hidden="true">
                  <Clock size={23} strokeWidth={2.1} />
                </span>
                <div>
                  <strong>{selectedTime || "--:--"}</strong>
                  <p>{selectedTime ? longDate : "Escolha um horario disponivel"}</p>
                </div>
              </div>
            </div>

            <button className="public-submit-button" disabled={submitting || !selectedTime} type="submit">
              <CalendarDays size={21} strokeWidth={2.2} />
              {submitting ? "Agendando..." : "Agendar horario"}
            </button>

            <p className="public-secure-note">
              <Lock size={16} strokeWidth={2} />
              Seus dados estao protegidos e seguros
            </p>
          </form>
        </div>

        <footer className="public-footer-note">
          <span aria-hidden="true">
            <Scissors size={20} strokeWidth={2} />
          </span>
          <p>
            <strong>Agendamento rapido, pratico e seguro</strong>
            Qualquer duvida, entre em contato conosco.
          </p>
        </footer>
      </section>
    </main>
  );
}
