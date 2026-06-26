import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePlatformAuth } from "../context/PlatformAuthContext.jsx";
import platformApi from "../services/platformApi.js";
import { getFriendlyErrorMessage } from "../utils/errors.js";

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(safeNumber(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number(value) || 0);
}

function formatDate(value, withTime = false) {
  if (!value) return "Nao informado";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(new Date(value));
  } catch {
    return "Nao informado";
  }
}

function formatTime(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function normalizedStatus(status) {
  return String(status || "").toLowerCase();
}

function statusLabel(status) {
  const normalized = normalizedStatus(status);
  if (normalized === "active") return "Ativa";
  if (normalized === "suspended") return "Suspensa";
  if (normalized === "confirmed") return "Confirmado";
  if (normalized === "pending") return "Pendente";
  if (normalized === "canceled") return "Cancelado";
  return "Indefinido";
}

function planLabel(plan) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "free") return "Free";
  if (normalized === "basic") return "Basic";
  if (normalized === "premium") return "Premium";
  return "Sem plano";
}

function PlatformDetailShell({ children }) {
  const { logout, user } = usePlatformAuth();

  return (
    <main className="platform-admin-screen">
      <aside className="platform-admin-sidebar">
        <div className="platform-admin-brand">
          <span>BF</span>
          <div>
            <strong>BarberFlow</strong>
            <small>Platform</small>
          </div>
        </div>

        <nav className="platform-admin-nav" aria-label="Navegacao administrativa">
          <Link to="/platform/dashboard">
            <Activity size={17} aria-hidden="true" />
            Dashboard
          </Link>
          <Link className="active" to="/platform/barbershops">
            <Building2 size={17} aria-hidden="true" />
            Barbearias
          </Link>
        </nav>

        <div className="platform-admin-user">
          <span>{(user?.email || "AD").slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>Administrador</strong>
            <small>{user?.email || "admin@barberflow.com"}</small>
          </div>
          <button onClick={() => logout()} type="button">
            Sair
          </button>
        </div>
      </aside>

      <section className="platform-admin-main">{children}</section>
    </main>
  );
}

export default function PlatformBarbershopDetail() {
  const { id } = useParams();
  const [barbershop, setBarbershop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDetail() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await platformApi.get(`/platform/barbershops/${id}/`);
      setBarbershop(response.data || null);
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Nao foi possivel carregar os detalhes da barbearia."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function changeStatus(action) {
    const isSuspend = action === "suspend";

    if (isSuspend && !window.confirm("Tem certeza que deseja suspender esta barbearia?")) {
      return;
    }

    setActionLoading(action);
    setError("");
    setMessage("");

    try {
      const response = await platformApi.patch(`/platform/barbershops/${id}/${action}/`);
      const responseBarbershop = response.data?.barbershop || {};
      const nextStatus = String(responseBarbershop.status || (isSuspend ? "SUSPENDED" : "ACTIVE")).toLowerCase();

      setBarbershop((current) => (current ? { ...current, status: nextStatus } : current));
      setMessage(response.data?.detail || (isSuspend ? "Barbearia suspensa com sucesso." : "Barbearia reativada com sucesso."));
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Nao foi possivel concluir a operacao."));
    } finally {
      setActionLoading("");
    }
  }

  const metrics = useMemo(() => {
    const data = barbershop?.metrics || {};
    return [
      { label: "Agendamentos", value: data.total_appointments, icon: CalendarDays },
      { label: "Hoje", value: data.appointments_today, icon: Activity },
      { label: "Este mes", value: data.appointments_this_month, icon: CalendarDays },
      { label: "Clientes", value: data.total_clients, icon: UsersRound },
      { label: "Servicos", value: data.total_services, icon: Scissors },
    ];
  }, [barbershop]);

  const status = normalizedStatus(barbershop?.status);
  const isSuspended = status === "suspended";
  const publicLink = barbershop?.public_link ? `${window.location.origin}${barbershop.public_link}` : "";

  return (
    <PlatformDetailShell>
      <header className="platform-dashboard-header">
        <div>
          <p>Detalhes da barbearia</p>
          <h1>{barbershop?.name || "Barbearia"}</h1>
          <span>Visualize dados operacionais e controle o acesso desta conta.</span>
        </div>
        <Link to="/platform/barbershops">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para barbearias
        </Link>
      </header>

      {loading ? (
        <section className="platform-state-card">Carregando detalhes da barbearia...</section>
      ) : error && !barbershop ? (
        <section className="platform-state-card platform-state-error">
          <strong>{error}</strong>
          <button onClick={loadDetail} type="button">
            Tentar novamente
          </button>
        </section>
      ) : barbershop ? (
        <div className="platform-detail-page">
          {message ? <div className="platform-feedback platform-feedback-success">{message}</div> : null}
          {error ? <div className="platform-feedback platform-feedback-error">{error}</div> : null}

          <section className="platform-panel platform-detail-hero">
            <div>
              <span className="platform-detail-icon">
                <Building2 size={24} aria-hidden="true" />
              </span>
              <p>Conta SaaS</p>
              <h2>{barbershop.name || "Barbearia sem nome"}</h2>
              <div className="platform-detail-badges">
                <span className={`platform-status platform-status-${barbershop.status || "unknown"}`}>
                  {statusLabel(barbershop.status)}
                </span>
                <span className={`platform-plan platform-plan-${barbershop.plan || "unknown"}`}>
                  {planLabel(barbershop.plan)}
                </span>
              </div>
            </div>

            <div className="platform-detail-actions">
              {isSuspended ? (
                <button
                  className="platform-action-success"
                  disabled={Boolean(actionLoading)}
                  onClick={() => changeStatus("reactivate")}
                  type="button"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  {actionLoading === "reactivate" ? "Reativando..." : "Reativar"}
                </button>
              ) : (
                <button
                  className="platform-action-danger"
                  disabled={Boolean(actionLoading)}
                  onClick={() => changeStatus("suspend")}
                  type="button"
                >
                  <ShieldAlert size={16} aria-hidden="true" />
                  {actionLoading === "suspend" ? "Suspendendo..." : "Suspender"}
                </button>
              )}
            </div>
          </section>

          <section className="platform-metric-grid platform-detail-metrics" aria-label="Metricas da barbearia">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className="platform-metric-card" key={metric.label}>
                  <span>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <p>{metric.label}</p>
                  <strong>{formatNumber(metric.value)}</strong>
                  <small>Dados desta barbearia</small>
                </article>
              );
            })}
          </section>

          <section className="platform-detail-grid">
            <article className="platform-panel platform-info-card">
              <div className="platform-panel-heading">
                <div>
                  <p>Perfil</p>
                  <h2>Informacoes principais</h2>
                </div>
              </div>

              <dl className="platform-detail-list">
                <div>
                  <dt>Data de criacao</dt>
                  <dd>{formatDate(barbershop.created_at)}</dd>
                </div>
                <div>
                  <dt>Atualizado em</dt>
                  <dd>{formatDate(barbershop.updated_at, true)}</dd>
                </div>
                <div>
                  <dt>Proprietario</dt>
                  <dd>{barbershop.owner?.name || "Nao informado"}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{barbershop.owner?.email || barbershop.email || "Nao informado"}</dd>
                </div>
                <div>
                  <dt>Ultimo login</dt>
                  <dd>{formatDate(barbershop.owner?.last_login, true)}</dd>
                </div>
                <div>
                  <dt>Cidade</dt>
                  <dd>{barbershop.city || "Nao informada"}</dd>
                </div>
              </dl>
            </article>

            <article className="platform-panel platform-info-card">
              <div className="platform-panel-heading">
                <div>
                  <p>Publico</p>
                  <h2>Link de agendamento</h2>
                </div>
              </div>

              {publicLink ? (
                <div className="platform-public-link">
                  <span>{publicLink}</span>
                  <a href={publicLink} rel="noreferrer" target="_blank">
                    <ExternalLink size={15} aria-hidden="true" />
                    Abrir
                  </a>
                </div>
              ) : (
                <div className="platform-empty-state">Link publico indisponivel.</div>
              )}
            </article>
          </section>

          <section className="platform-detail-grid">
            <article className="platform-panel">
              <div className="platform-panel-heading">
                <div>
                  <p>Agenda</p>
                  <h2>Ultimos agendamentos</h2>
                </div>
              </div>

              {barbershop.latest_appointments?.length ? (
                <div className="platform-detail-list-card">
                  {barbershop.latest_appointments.map((appointment) => (
                    <div className="platform-detail-row-card" key={appointment.id}>
                      <div>
                        <strong>{appointment.client_name || "Cliente sem nome"}</strong>
                        <span>{appointment.client_phone || "Sem telefone"}</span>
                      </div>
                      <div>
                        <strong>{formatTime(appointment.time)}</strong>
                        <span>{formatDate(appointment.date)}</span>
                      </div>
                      <span className={`platform-status platform-status-${appointment.status || "unknown"}`}>
                        {statusLabel(appointment.status)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">Nenhum agendamento encontrado.</div>
              )}
            </article>

            <article className="platform-panel">
              <div className="platform-panel-heading">
                <div>
                  <p>Catalogo</p>
                  <h2>Servicos cadastrados</h2>
                </div>
              </div>

              {barbershop.services?.length ? (
                <div className="platform-detail-list-card">
                  {barbershop.services.map((service) => (
                    <div className="platform-detail-row-card" key={service.id}>
                      <div>
                        <strong>{service.name || "Servico sem nome"}</strong>
                        <span>Cadastrado em {formatDate(service.created_at)}</span>
                      </div>
                      <strong>{formatMoney(service.price)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">Nenhum servico cadastrado.</div>
              )}
            </article>
          </section>
        </div>
      ) : (
        <section className="platform-state-card">Barbearia nao encontrada.</section>
      )}
    </PlatformDetailShell>
  );
}
