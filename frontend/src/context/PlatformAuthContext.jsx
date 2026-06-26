import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../services/auth.js";
import platformApi from "../services/platformApi.js";
import {
  clearPlatformSession,
  getPlatformAccessToken,
  getStoredPlatformUser,
  savePlatformAuthSession,
} from "../services/platformAuth.js";

const PLATFORM_ACCESS_DENIED = "Este acesso e exclusivo para administradores da plataforma.";

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredPlatformUser());
  const [accessToken, setAccessToken] = useState(() => getPlatformAccessToken());
  const [loading, setLoading] = useState(Boolean(getPlatformAccessToken()));

  const isPlatformAuthenticated = Boolean(accessToken && user?.is_platform_admin);

  function clearState() {
    setUser(null);
    setAccessToken(null);
  }

  async function validatePlatformAccess() {
    await platformApi.get("/platform/dashboard/", { skipPlatformRedirect: true });
    return true;
  }

  async function login({ email, password }) {
    const response = await axios.post(`${API_BASE_URL}/login/`, { email, password });
    const { access, refresh, user: loggedUser } = response.data;

    if (!access || !refresh || !loggedUser) {
      throw new Error("Resposta de login administrativo invalida.");
    }

    try {
      await axios.get(`${API_BASE_URL}/platform/dashboard/`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });
    } catch (error) {
      clearPlatformSession({ redirect: false });
      clearState();

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error(PLATFORM_ACCESS_DENIED);
      }

      throw error;
    }

    savePlatformAuthSession({ access, refresh, user: loggedUser });
    setAccessToken(access);
    setUser({ ...loggedUser, is_platform_admin: true });

    return response.data;
  }

  function logout({ redirect = true } = {}) {
    clearPlatformSession({ redirect });
    clearState();
  }

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    validatePlatformAccess()
      .catch(() => {
        clearPlatformSession({ redirect: false });
        clearState();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleAuthCleared() {
      clearState();
    }

    window.addEventListener("barberflow:platform-auth-cleared", handleAuthCleared);
    return () => window.removeEventListener("barberflow:platform-auth-cleared", handleAuthCleared);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isPlatformAuthenticated,
      login,
      logout,
      validatePlatformAccess,
    }),
    [user, loading, isPlatformAuthenticated],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error("usePlatformAuth deve ser usado dentro de PlatformAuthProvider");
  }
  return context;
}

export { PLATFORM_ACCESS_DENIED };
