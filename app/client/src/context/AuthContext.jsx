import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, auth } from "../lib/api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!auth.hasToken()) {
      setUser(null); setTeam(null); setLoading(false);
      return;
    }
    try {
      const res = await api.me();
      setUser(res.user);
      setTeam(res.team);
    } catch {
      auth.clearToken();
      setUser(null); setTeam(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (data) => {
    const res = await api.login(data);
    auth.saveToken(res.token);
    await refresh();
  };
  const signup = async (data) => {
    const res = await api.signup(data);
    auth.saveToken(res.token);
    await refresh();
  };
  const accept = async (data) => {
    const res = await api.accept(data);
    auth.saveToken(res.token);
    await refresh();
  };
  const logout = () => {
    auth.clearToken();
    setUser(null); setTeam(null);
    window.location.href = "/";
  };

  return (
    <AuthCtx.Provider value={{ user, team, loading, login, signup, accept, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
