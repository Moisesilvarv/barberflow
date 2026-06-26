import {
  Activity,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Eye,
  Scissors,
  Store,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { usePlatformAuth } from "../context/PlatformAuthContext.jsx";
import platformApi from "../services/platformApi.js";
import { getFriendlyErrorMessage } from "../utils/errors.js";

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(safeNumber(value));
}

function formatDate(value) {
  if (!value) return "Sem data";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Sem data";
  }
}

function statusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "Ativa";
  if (normalized === "suspended") return "Suspensa";
  return "Indefinido";
}

function PlatformDashboardShell({ children }) {
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
          <Link className="active" to="/platform/dashboard">
            <Activity size={17} aria-hidden="true" />
            Dashboard
          </Link>
          <Link to="/platform/barbershops">
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

export default function PlatformDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGrowth, setShowGrowth] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await platformApi.get("/platform/dashboard/");
      setDashboard(response.data || {});
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Nao foi possivel carregar o dashboard administrativo."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const platform = dashboard?.platform || {};
    const users = dashboard?.users || {};
    const appointments = dashboard?.appointments || {};
    const clients = dashboard?.clients || {};
    const services = dashboard?.services || {};

    return [
      {
        label: "Total de barbearias",
        value: platform.total_barbershops,
        helper: "Empresas cadastradas",
        icon: Store,
      },
      {
        label: "Barbearias ativas",
        value: platform.active_barbershops,
        helper: "Operando na plataforma",
        icon: CalendarCheck,
      },
      {
        label: "Suspensas",
        value: platform.suspended_barbershops,
        helper: "Acesso bloqueado",
        icon: Clock3,
      },
      {
        label: "Novas este mes",
        value: platform.new_barbershops_this_month,
        helper: "Crescimento recente",
        icon: TrendingUp,
      },
      {
        label: "Usuarios",
        value: users.total_users,
        helper: "Contas no sistema",
        icon: UserRound,
      },
      {
        label: "Agendamentos",
        value: appointments.total,
        helper: "Total historico",
        icon: CalendarDays,
      },
      {
        label: "Hoje",
        value: appointments.today,
        helper: "Agendamentos do dia",
        icon: Activity,
      },
      {
        label: "Este mes",
        value: appointments.this_month,
        helper: "Volume mensal",
        icon: TrendingUp,
      },
      {
        label: "Clientes",
        value: clients.total,
        helper: "Clientes cadastrados",
        icon: UsersRound,
      },
      {
        label: "Servicos",
        value: services.total,
        helper: "Servicos cadastrados",
        icon: Scissors,
      },
    ];
  }, [dashboard]);

  const growth = dashboard?.growth?.appointments_last_30_days || [];
  const recentBarbershops = dashboard?.recent_barbershops || [];
  const maxGrowthCount = Math.max(...growth.map((item) => safeNumber(item.count)), 1);
  const growthTotal = growth.reduce((total, item) => total + safeNumber(item.count), 0);
  const growthPreview = growth.slice(-7);

  return (
    <PlatformDashboardShell>
      <header className="platform-dashboard-header">
        <div>
          <p>Painel administrativo</p>
          <h1>Visao geral da plataforma BarberFlow</h1>
          <span>Acompanhe barbearias, usuarios e operacoes do SaaS em tempo real.</span>
        </div>
        <Link to="/platform/barbershops">Ver barbearias</Link>
      </header>

      {loading ? (
        <section className="platform-state-card">Carregando metricas administrativas...</section>
      ) : error ? (
        <section className="platform-state-card platform-state-error">
          <strong>{error}</strong>
          <button onClick={loadDashboard} type="button">
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className="platform-metric-grid" aria-label="Metricas principais">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className="platform-metric-card" key={metric.label}>
                  <span>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <p>{metric.label}</p>
                  <strong>{formatNumber(metric.value)}</strong>
                  <small>{metric.helper}</small>
                </article>
              );
            })}
          </section>

          <section className="platform-dashboard-grid">
            <article className="platform-panel">
              <div className="platform-panel-heading">
                <div>
                  <p>Crescimento</p>
                  <h2>Agendamentos dos ultimos 30 dias</h2>
                </div>
                {growth.length ? (
                  <button className="platform-panel-toggle" onClick={() => setShowGrowth((current) => !current)} type="button">
                    {showGrowth ? "Ocultar" : "Abrir"}
                  </button>
                ) : null}
              </div>

              {growth.length ? (
                <>
                  <div className="platform-growth-summary">
                    <div>
                      <strong>{formatNumber(growthTotal)}</strong>
                      <span>agendamentos no periodo</span>
                    </div>
                    <small>{showGrowth ? "Exibindo todos os 30 dias" : "Previa dos ultimos 7 dias"}</small>
                  </div>

                  <div className="platform-growth-list">
                    {(showGrowth ? growth.slice(-30) : growthPreview).map((item) => (
                      <div className="platform-growth-row" key={item.date}>
                        <span>{formatDate(item.date)}</span>
                        <div>
                          <i style={{ width: `${Math.max((safeNumber(item.count) / maxGrowthCount) * 100, 4)}%` }} />
                        </div>
                        <strong>{formatNumber(item.count)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="platform-empty-state">Nenhum agendamento registrado nos ultimos 30 dias.</div>
              )}
            </article>

            <article className="platform-panel">
              <div className="platform-panel-heading">
                <div>
                  <p>Recentes</p>
                  <h2>Ultimas barbearias cadastradas</h2>
                </div>
              </div>

              {recentBarbershops.length ? (
                <div className="platform-recent-list">
                  {recentBarbershops.map((barbershop) => (
                    <div className="platform-recent-row" key={barbershop.id}>
                      <span className="platform-recent-avatar">
                        <Scissors size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{barbershop.name || "Barbearia sem nome"}</strong>
                        <span>Cadastrada em {formatDate(barbershop.created_at)}</span>
                      </div>
                      <span className={`platform-status platform-status-${barbershop.status || "unknown"}`}>
                        {statusLabel(barbershop.status)}
                      </span>
                      <Link to={`/platform/barbershops/${barbershop.id}`}>
                        <Eye size={15} aria-hidden="true" />
                        Ver
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">Nenhuma barbearia cadastrada ainda.</div>
              )}
            </article>
          </section>
        </>
      )}
    </PlatformDashboardShell>
  );
}
