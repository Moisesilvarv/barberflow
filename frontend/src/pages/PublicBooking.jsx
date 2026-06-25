import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import api from "../services/api";

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

export default function PublicBooking() {
  const { barbershop_id } = useParams();
  const [date, setDate] = useState(defaultBookingDate);
  const [availability, setAvailability] = useState({ available: [], occupied: [] });
  const [shopName, setShopName] = useState("Barbearia");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState({ client_name: "", client_phone: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allSlots = useMemo(() => {
    return [...availability.available, ...availability.occupied].sort();
  }, [availability]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setSuccess("");
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
        const message =
          requestError.response?.data?.date ||
          requestError.response?.data?.detail ||
          "Não foi possível carregar os horários.";
        setAvailability({ available: [], occupied: [] });
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [barbershop_id, date]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedTime) {
      setError("Escolha um horário disponível.");
      return;
    }

    const confirmed = window.confirm(`Agendar ${date} às ${selectedTime}?`);
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
      setSuccess("Horário solicitado com sucesso. Aguarde a confirmação da barbearia.");
      setForm({ client_name: "", client_phone: "" });
      setSelectedTime("");
      const response = await api.get(`/public/${barbershop_id}/availability/`, { params: { date } });
      setAvailability({
        available: response.data.available || [],
        occupied: response.data.occupied || [],
      });
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || requestError.response?.data?.non_field_errors?.[0];
      setError(detail || "Não foi possível agendar esse horário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-page">
      <section className="public-shell">
        <header className="public-header">
          <span className="brand-mark">BF</span>
          <div>
            <p className="eyebrow">Agendamento online</p>
            <h1>{shopName}</h1>
          </div>
        </header>

        <div className="public-grid">
          <section className="public-panel">
            <label>
              Escolha uma data
              <input min={todayIso()} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>

            <div className="slot-section">
              <div className="panel-header">
                <h2>Horários</h2>
                <span>{date}</span>
              </div>

              {loading ? (
                <div className="empty-state">Carregando horários...</div>
              ) : allSlots.length === 0 ? (
                <div className="empty-state">Nenhum horário disponível para esta data.</div>
              ) : (
                <div className="slot-grid">
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
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <form className="public-panel booking-form" onSubmit={handleSubmit}>
            <div>
              <p className="eyebrow">Seus dados</p>
              <h2>Confirmar horário</h2>
            </div>

            {success && <div className="form-success">{success}</div>}
            {error && <div className="form-error">{error}</div>}

            <label>
              Nome
              <input name="client_name" onChange={updateField} required value={form.client_name} />
            </label>
            <label>
              Telefone
              <input name="client_phone" onChange={updateField} required value={form.client_phone} />
            </label>
            <label>
              Horário selecionado
              <input readOnly value={selectedTime ? `${date} às ${selectedTime}` : "Selecione um horário"} />
            </label>

            <button className="primary-button" disabled={submitting || !selectedTime} type="submit">
              {submitting ? "Agendando..." : "Agendar horário"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
