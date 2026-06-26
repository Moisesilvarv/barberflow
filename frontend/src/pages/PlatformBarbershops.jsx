import { Activity, Building2, Search, Store, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { usePlatformAuth } from "../context/PlatformAuthContext.jsx";
import platformApi from "../services/platformApi.js";
import { getFriendlyErrorMessage } from "../utils/errors.js";

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "SUSPENDED", label: "Suspensas" },
];

const planOptions = [
  { value: "", label: "Todos os planos" },
  { value: "FREE", label: "Free" },
  { value: "BASIC", label: "Basic" },
  { value: "PREMIUM", label: "Premium" },
];

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

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function statusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "Ativa";
  if (normalized === "suspended") return "Suspensa";
  return "Indefinido";
}

function planLabel(plan) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "free") return "Free";
  if (normalized === "basic") return "Basic";
  if (normalized === "premium") return "Premium";
  return "Sem plano";
}

function PlatformBarbershopsShell({ children }) {
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

export default function PlatformBarbershops() {
  const [barbershops, setBarbershops] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBarbershops() {
    setLoading(true);
    setError("");

    try {
      const response = await platformApi.get("/platform/barbershops/", {
        params: {
          page,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(plan ? { plan } : {}),
        },
      });
      const data = response.data || {};

      setBarbershops(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
      setCount(Number(data.count) || (Array.isArray(data) ? data.length : 0));
      setNext(data.next || null);
      setPrevious(data.previous || null);
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Nao foi possivel carregar as barbearias."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBarbershops();
  }, [page, search, status, plan]);

  const summary = useMemo(() => {
    const active = barbershops.filter((item) => String(item.status || "").toLowerCase() === "active").length;
    const suspended = barbershops.filter((item) => String(item.status || "").toLowerCase() === "suspended").length;

    return [
      { label: "Total exibido", value: count, helper: "Resultado da busca atual", icon: Store },
      { label: "Ativas nesta pagina", value: active, helper: "Barbearias operando", icon: Activity },
      { label: "Suspensas nesta pagina", value: suspended, helper: "Acesso bloqueado", icon: UsersRound },
    ];
  }, [barbershops, count]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleStatusChange(event) {
    setPage(1);
    setStatus(event.target.value);
  }

  function handlePlanChange(event) {
    setPage(1);
    setPlan(event.target.value);
  }

  return (
    <PlatformBarbershopsShell>
      <header className="platform-dashboard-header">
        <div>
          <p>Gestao SaaS</p>
          <h1>Barbearias</h1>
          <span>Gerencie os clientes cadastrados no BarberFlow.</span>
        </div>
        <Link to="/platform/dashboard">Voltar ao dashboard</Link>
      </header>

      <section className="platform-metric-grid platform-barbershop-summary" aria-label="Resumo de barbearias">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <article className="platform-metric-card" key={item.label}>
              <span>
                <Icon size={18} aria-hidden="true" />
              </span>
              <p>{item.label}</p>
              <strong>{formatNumber(item.value)}</strong>
              <small>{item.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="platform-panel platform-barbershop-panel">
        <div className="platform-barbershop-toolbar">
          <form onSubmit={handleSearchSubmit}>
            <label className="sr-only" htmlFor="platform-search">
              Buscar barbearia
            </label>
            <span>
              <Search size={18} aria-hidden="true" />
              <input
                id="platform-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por nome ou e-mail"
                type="search"
                value={searchInput}
              />
            </span>
            <button type="submit">Buscar</button>
          </form>

          <select aria-label="Filtrar por status" onChange={handleStatusChange} value={status}>
            {statusOptions.map((option) => (
              <option key={option.value || "all-status"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select aria-label="Filtrar por plano" onChange={handlePlanChange} value={plan}>
            {planOptions.map((option) => (
              <option key={option.value || "all-plan"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="platform-empty-state">Carregando barbearias...</div>
        ) : error ? (
          <div className="platform-state-card platform-state-error">
            <strong>{error}</strong>
            <button onClick={loadBarbershops} type="button">
              Tentar novamente
            </button>
          </div>
        ) : barbershops.length ? (
          <>
            <div className="platform-barbershop-table" role="table" aria-label="Barbearias cadastradas">
              <div className="platform-barbershop-row platform-barbershop-head" role="row">
                <span>Barbearia</span>
                <span>Proprietario</span>
                <span>Status</span>
                <span>Plano</span>
                <span>Cadastro</span>
                <span>Ultimo login</span>
                <span>Metricas</span>
                <span>Acoes</span>
              </div>

              {barbershops.map((barbershop) => (
                <div className="platform-barbershop-row" key={barbershop.id} role="row">
                  <div>
                    <strong>{barbershop.name || "Barbearia sem nome"}</strong>
                    <small>ID #{barbershop.id || "-"}</small>
                  </div>
                  <div>
                    <strong>{barbershop.owner_name || "Nao informado"}</strong>
                    <small>{barbershop.owner_email || "Sem e-mail"}</small>
                  </div>
                  <span className={`platform-status platform-status-${barbershop.status || "unknown"}`}>
                    {statusLabel(barbershop.status)}
                  </span>
                  <span className={`platform-plan platform-plan-${barbershop.plan || "unknown"}`}>
                    {planLabel(barbershop.plan)}
                  </span>
                  <span>{formatDate(barbershop.created_at)}</span>
                  <span>{formatDate(barbershop.last_login, true)}</span>
                  <div className="platform-mini-metrics">
                    <span>{formatNumber(barbershop.appointments_count)} ag.</span>
                    <span>{formatNumber(barbershop.services_count)} serv.</span>
                    <span>{formatNumber(barbershop.clients_count)} clientes</span>
                  </div>
                  <Link to={`/platform/barbershops/${barbershop.id}`}>Ver detalhes</Link>
                </div>
              ))}
            </div>

            <div className="platform-pagination">
              <span>
                Pagina {page} - {formatNumber(count)} resultado(s)
              </span>
              <div>
                <button disabled={!previous || page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} type="button">
                  Anterior
                </button>
                <button disabled={!next} onClick={() => setPage((current) => current + 1)} type="button">
                  Proxima
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="platform-empty-state">Nenhuma barbearia encontrada para os filtros atuais.</div>
        )}
      </section>
    </PlatformBarbershopsShell>
  );
}
