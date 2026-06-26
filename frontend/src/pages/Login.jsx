import { Eye, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errors";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await login({
        email: form.email,
        password: form.password,
      });
      toast.success("Login realizado com sucesso.");
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      toast.error(getFriendlyErrorMessage(requestError, "Email ou senha invalidos."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-copy">
          <div className="login-pattern login-pattern-top" aria-hidden="true" />
          <div className="login-rings" aria-hidden="true" />
          <div className="login-pattern login-pattern-bottom" aria-hidden="true" />

          <div className="login-copy-content">
            <span className="login-logo">BF</span>
            <h1>BarberFlow</h1>
            <span className="login-divider" aria-hidden="true" />
            <p>Agenda, clientes e horarios em um painel simples para a rotina da barbearia.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <p className="login-eyebrow">Acesso do barbeiro</p>
            <h2>Entrar</h2>
          </div>

          <label>
            E-mail
            <span className="login-input-wrap">
              <Mail size={21} strokeWidth={2} aria-hidden="true" />
              <input
                autoComplete="email"
                disabled={loading}
                name="email"
                onChange={updateField}
                placeholder="voce@barbearia.com"
                required
                type="email"
                value={form.email}
              />
            </span>
          </label>

          <label>
            Senha
            <span className="login-input-wrap">
              <Lock size={21} strokeWidth={2} aria-hidden="true" />
              <input
                autoComplete="current-password"
                disabled={loading}
                name="password"
                onChange={updateField}
                placeholder="Sua senha"
                required
                type={showPassword ? "text" : "password"}
                value={form.password}
              />
              <button
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="password-toggle"
                disabled={loading}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <Eye size={21} strokeWidth={2} />
              </button>
            </span>
          </label>

          <button className="login-submit" disabled={loading} type="submit">
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>
      </section>
    </main>
  );
}
