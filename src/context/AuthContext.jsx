import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getToken, setToken, clearToken } from "../api/client";
import { login as loginRequest, fetchMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts true whenever a token is already stored, so the app doesn't
  // flash the login screen for a split second before the stored token is
  // verified against the server.
  const [loading, setLoading] = useState(!!getToken());

  const verifyStoredToken = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    verifyStoredToken();
  }, [verifyStoredToken]);

  // Fired by the axios interceptor in api/client.js whenever a request
  // comes back 401 — the session is over server-side (expired, or the
  // token is simply invalid), so drop it here too.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("zeno:unauthorized", onUnauthorized);
    return () => window.removeEventListener("zeno:unauthorized", onUnauthorized);
  }, []);

  const login = async (username, password) => {
    const { token, user: loggedInUser } = await loginRequest(username, password);
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAdmin: user?.role === "admin", loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
