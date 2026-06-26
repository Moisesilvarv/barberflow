import { API_BASE_URL } from "./auth.js";

const PLATFORM_ACCESS_KEY = "barberflow_platform_access";
const PLATFORM_REFRESH_KEY = "barberflow_platform_refresh";
const PLATFORM_USER_KEY = "barberflow_platform_user";

export function getPlatformAccessToken() {
  return localStorage.getItem(PLATFORM_ACCESS_KEY);
}

export function getPlatformRefreshToken() {
  return localStorage.getItem(PLATFORM_REFRESH_KEY);
}

export function getStoredPlatformUser() {
  const storedUser = localStorage.getItem(PLATFORM_USER_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(PLATFORM_USER_KEY);
    return null;
  }
}

export function savePlatformAuthSession({ access, refresh, user }) {
  localStorage.setItem(PLATFORM_ACCESS_KEY, access);
  localStorage.setItem(PLATFORM_REFRESH_KEY, refresh);
  localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify({ ...user, is_platform_admin: true }));
}

export function savePlatformAccessToken(access) {
  localStorage.setItem(PLATFORM_ACCESS_KEY, access);
}

export async function refreshPlatformToken() {
  const refresh = getPlatformRefreshToken();
  if (!refresh) {
    throw new Error("Refresh token administrativo ausente.");
  }

  const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    throw new Error("Sessao administrativa expirada.");
  }

  const data = await response.json();
  savePlatformAccessToken(data.access);
  return data.access;
}

export function clearPlatformSession({ redirect = false } = {}) {
  localStorage.removeItem(PLATFORM_ACCESS_KEY);
  localStorage.removeItem(PLATFORM_REFRESH_KEY);
  localStorage.removeItem(PLATFORM_USER_KEY);
  window.dispatchEvent(new Event("barberflow:platform-auth-cleared"));

  if (redirect && window.location.pathname !== "/platform/login") {
    window.location.assign("/platform/login");
  }
}
