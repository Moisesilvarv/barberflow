import { Copy, ExternalLink, Link, Store } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { formatName } from "../utils/formatters";

export default function Configuracoes() {
  const { barberShop, user } = useAuth();
  const publicLink = barberShop ? `${window.location.origin}/public/${barberShop.id}` : "";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <p className="settings-eyebrow">Configura&ccedil;&otilde;es</p>
        <h1>Perfil da barbearia</h1>
        <p>Gerencie as informa&ccedil;&otilde;es da sua barbearia e o link p&uacute;blico.</p>
      </header>

      <section className="settings-card-grid">
        <article className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon-box" aria-hidden="true">
              <Store size={25} strokeWidth={2.2} />
            </span>
            <h2>Dados do perfil</h2>
          </div>

          <div className="settings-details">
            <div className="settings-detail-row">
              <span>Barbearia</span>
              <strong>{barberShop?.name ? formatName(barberShop.name) : "-"}</strong>
            </div>
            <div className="settings-detail-row">
              <span>Cidade</span>
              <strong>{barberShop?.city ? formatName(barberShop.city) : "-"}</strong>
            </div>
            <div className="settings-detail-row">
              <span>E-mail</span>
              <strong>{user?.email || barberShop?.email || "-"}</strong>
            </div>
          </div>
        </article>

        <article className="settings-card settings-public-card">
          <div className="settings-card-heading">
            <span className="settings-icon-box" aria-hidden="true">
              <Link size={25} strokeWidth={2.2} />
            </span>
            <h2>Link p&uacute;blico</h2>
          </div>

          <p className="settings-description">
            P&aacute;gina p&uacute;blica para clientes consultarem hor&aacute;rios e solicitarem agendamento.
          </p>

          <div className="settings-link-box">
            <span>{publicLink || "-"}</span>
            <button type="button" className="copy-link-button" onClick={handleCopy} disabled={!publicLink}>
              <Copy size={20} strokeWidth={2.1} />
              <span>{copied ? "Copiado" : "Copiar link"}</span>
            </button>
          </div>

          <a
            className="open-public-link"
            href={publicLink || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!publicLink}
          >
            <ExternalLink size={20} strokeWidth={2.2} />
            Abrir p&aacute;gina
          </a>
        </article>
      </section>
    </div>
  );
}
