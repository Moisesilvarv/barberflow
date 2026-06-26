import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({
        email: form.email,
        password: form.password,
      });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      console.error("Erro real no login:", requestError);
      setError("Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-copy">
          <span className="brand-mark">BF</span>
          <h1>BarberFlow</h1>
          <p>Agenda, clientes e horários em um painel simples para a rotina da barbearia.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Acesso do barbeiro</p>
            <h2>Entrar</h2>
          </div>

          {error && <div className="form-error">{error}</div>}

          <label>
            E-mail
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
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              disabled={loading}
              name="password"
              onChange={updateField}
              placeholder="Sua senha"
              required
              type="password"
              value={form.password}
            />
          </label>

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>
      </section>
    </main>
  );
}
