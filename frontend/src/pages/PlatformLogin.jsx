import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { usePlatformAuth, PLATFORM_ACCESS_DENIED } from "../context/PlatformAuthContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errors.js";

export default function PlatformLogin() {
  const { isPlatformAuthenticated, login } = usePlatformAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isPlatformAuthenticated) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      await login({
        email: form.email,
        password: form.password,
      });
      navigate("/platform/dashboard", { replace: true });
    } catch (requestError) {
      if (requestError.message === PLATFORM_ACCESS_DENIED) {
        setError(PLATFORM_ACCESS_DENIED);
      } else {
        setError(getFriendlyErrorMessage(requestError, "Nao foi possivel entrar no painel administrativo."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="platform-login-screen">
      <section className="platform-login-card">
        <div className="platform-login-brand" aria-hidden="true">
          <span>BF</span>
        </div>

        <div className="platform-login-heading">
          <p>Acesso administrativo</p>
          <h1>BarberFlow Platform</h1>
          <span>Gerencie barbearias, metricas e operacoes da plataforma.</span>
        </div>

        <form className="platform-login-form" onSubmit={handleSubmit}>
          {error ? <div className="platform-login-error">{error}</div> : null}

          <label>
            E-mail
            <span className="platform-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                autoComplete="email"
                disabled={loading}
                name="email"
                onChange={updateField}
                placeholder="admin@barberflow.com"
                required
                type="email"
                value={form.email}
              />
            </span>
          </label>

          <label>
            Senha
            <span className="platform-input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                autoComplete="current-password"
                disabled={loading}
                name="password"
                onChange={updateField}
                placeholder="Sua senha administrativa"
                required
                type="password"
                value={form.password}
              />
            </span>
          </label>

          <button className="platform-login-submit" disabled={loading} type="submit">
            <ShieldCheck size={18} aria-hidden="true" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
