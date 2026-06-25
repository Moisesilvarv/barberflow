import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api, { clearStoredAuth } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("barberflow_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [barberShop, setBarberShop] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("barberflow_access"));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("barberflow_access")));

  const isAuthenticated = Boolean(accessToken);

  function clearSessionState() {
    setAccessToken(null);
    setUser(null);
    setBarberShop(null);
  }

  async function loadMe() {
    const response = await api.get("/me/");
    setUser(response.data.user);
    setBarberShop(response.data.barber_shop);
    localStorage.setItem("barberflow_user", JSON.stringify(response.data.user));
    return response.data;
  }

  async function login({ email, password }) {
    const response = await api.post("/login/", { email, password });
    localStorage.setItem("barberflow_access", response.data.access);
    localStorage.setItem("barberflow_refresh", response.data.refresh);
    localStorage.setItem("barberflow_user", JSON.stringify(response.data.user));
    setAccessToken(response.data.access);
    setUser(response.data.user);
    await loadMe();
    return response.data;
  }

  async function logout() {
    const refresh = localStorage.getItem("barberflow_refresh");
    if (refresh) {
      try {
        await api.post("/logout/", { refresh });
      } catch {
        // The local session should be cleared even if the refresh token is already invalid.
      }
    }
    clearStoredAuth();
    clearSessionState();
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadMe()
      .catch(() => {
        clearStoredAuth();
        clearSessionState();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleAuthCleared() {
      clearSessionState();
    }

    window.addEventListener("barberflow:auth-cleared", handleAuthCleared);
    return () => window.removeEventListener("barberflow:auth-cleared", handleAuthCleared);
  }, []);

  const value = useMemo(
    () => ({
      user,
      barberShop,
      loading,
      isAuthenticated,
      login,
      logout,
      loadMe,
    }),
    [user, barberShop, loading, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
