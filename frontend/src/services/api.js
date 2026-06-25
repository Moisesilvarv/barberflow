import axios from "axios";

export function clearStoredAuth() {
  localStorage.removeItem("barberflow_access");
  localStorage.removeItem("barberflow_refresh");
  localStorage.removeItem("barberflow_user");
  window.dispatchEvent(new Event("barberflow:auth-cleared"));
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("barberflow_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth();
    }
    return Promise.reject(error);
  },
);

export default api;
