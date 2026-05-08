import axios from "axios";
import { getApiBaseUrl } from "./env";
import { clearAuth, getToken } from "./auth";

export const http = axios.create({
  baseURL: getApiBaseUrl(),
});

http.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuth();
    }

    return Promise.reject(error);
  }
);