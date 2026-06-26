import { formatPhone } from "../utils/phone";

const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmado",
  canceled: "Cancelado",
};

export default function AppointmentCard({ appointment, onConfirm, onCancel, onEdit }) {
  return (
    <article className="appointment-card">
      <div>
        <div className="appointment-time">{appointment.time?.slice(0, 5)}</div>
        <h3>{appointment.client_name}</h3>
        <p>{formatPhone(appointment.client_phone)}</p>
      </div>
      <div className="appointment-actions">
        <span className={`status-badge status-${appointment.status}`}>
          {statusLabels[appointment.status] || appointment.status}
        </span>
        <div className="button-row">
          <button type="button" className="ghost-button" onClick={() => onEdit(appointment)}>
            Editar
          </button>
          <button type="button" className="ghost-button" onClick={() => onConfirm(appointment)}>
            Confirmar
          </button>
          <button type="button" className="danger-button" onClick={() => onCancel(appointment)}>
            Cancelar
          </button>
        </div>
      </div>
    </article>
  );
}
