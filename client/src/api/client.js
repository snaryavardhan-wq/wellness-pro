import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server rejects the token, log out globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthCall = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err) =>
  err.response?.data?.errors?.map((e) => e.message).join(", ") ||
  err.response?.data?.message ||
  "Something went wrong";

export const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date()); // local YYYY-MM-DD
export const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default api;