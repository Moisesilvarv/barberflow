import axios from "axios";

import { API_BASE_URL } from "./auth.js";
import {
  clearPlatformSession,
  getPlatformAccessToken,
  refreshPlatformToken,
} from "./platformAuth.js";

const platformApi = axios.create({
  baseURL: API_BASE_URL,
});

let platformRefreshPromise = null;

platformApi.interceptors.request.use((config) => {
  const token = getPlatformAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isForbidden = error.response?.status === 403;
    const isRefreshRequest = originalRequest?.url?.includes("/token/refresh/");

    if (isForbidden && !originalRequest?.skipPlatformRedirect) {
      clearPlatformSession({ redirect: true });
      return Promise.reject(error);
    }

    if (isUnauthorized && originalRequest && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        platformRefreshPromise = platformRefreshPromise || refreshPlatformToken();
        const newAccessToken = await platformRefreshPromise;
        platformRefreshPromise = null;

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return platformApi(originalRequest);
      } catch (refreshError) {
        platformRefreshPromise = null;
        clearPlatformSession({ redirect: true });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default platformApi;
