import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../services/api";
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  logout as logoutSession,
  saveAuthSession,
} from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [barberShop, setBarberShop] = useState(null);
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [loading, setLoading] = useState(Boolean(getAccessToken()));

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
    const { access, refresh, user: loggedUser } = response.data;

    if (!access || !refresh || !loggedUser) {
      throw new Error("Resposta de login invalida: access, refresh ou user ausente.");
    }

    saveAuthSession({ access, refresh, user: loggedUser });
    setAccessToken(access);
    setUser(loggedUser);

    try {
      await loadMe();
    } catch {
      // Login stays valid even if profile hydration fails momentarily.
    }

    return response.data;
  }

  async function logout() {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await api.post("/logout/", { refresh });
      } catch {
        // The local session should be cleared even if the refresh token is already invalid.
      }
    }

    logoutSession({ redirect: false });
    clearSessionState();
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadMe()
      .catch(() => {
        logoutSession({ redirect: false });
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
