const ACCESS_KEY = "barberflow_access";
const REFRESH_KEY = "barberflow_refresh";
const USER_KEY = "barberflow_user";

function normalizeApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const cleanUrl = configuredUrl.replace(/\/$/, "");
  return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl();

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser() {
  const storedUser = localStorage.getItem(USER_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function saveAuthSession({ access, refresh, user }) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveAccessToken(access) {
  localStorage.setItem(ACCESS_KEY, access);
}

export async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new Error("Refresh token ausente.");
  }

  const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    throw new Error("Refresh token expirado ou inválido.");
  }

  const data = await response.json();
  saveAccessToken(data.access);
  return data.access;
}

export function logout({ redirect = true } = {}) {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("barberflow:auth-cleared"));

  if (redirect && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
