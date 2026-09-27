import axios from "axios";

const TOKEN_KEY = "zeno_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname.endsWith("vercel.app")
    ? "https://inventory-backend-1-b0zf.onrender.com/api"
    : "/api");

const client = axios.create({
  baseURL: apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A stale/invalid/expired token means the session is over — clear it and
// force back to the login screen rather than leaving the app stuck making
// requests that will keep failing. AuthContext listens for this event so
// it can also clear its own in-memory user state.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("zeno:unauthorized"));
    }
    return Promise.reject(err);
  }
);

export default client;
