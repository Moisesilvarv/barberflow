import { useAuth } from "../context/AuthContext.jsx";

export default function Configuracoes() {
  const { barberShop, user } = useAuth();
  const publicLink = barberShop ? `${window.location.origin}/public/${barberShop.id}` : "";

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Configurações</p>
          <h2>Perfil da barbearia</h2>
        </div>
      </div>

      <section className="settings-grid">
        <article className="panel">
          <div className="panel-header">
            <h3>Dados do perfil</h3>
          </div>
          <div className="detail-list">
            <div>
              <span>Barbearia</span>
              <strong>{barberShop?.name || "-"}</strong>
            </div>
            <div>
              <span>Cidade</span>
              <strong>{barberShop?.city || "-"}</strong>
            </div>
            <div>
              <span>E-mail</span>
              <strong>{user?.email || barberShop?.email || "-"}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Link público</h3>
          </div>
          <p className="muted-text">Página pública para clientes consultarem horários e solicitarem agendamento.</p>
          <div className="copy-field">{publicLink}</div>
        </article>
      </section>
    </div>
  );
}
