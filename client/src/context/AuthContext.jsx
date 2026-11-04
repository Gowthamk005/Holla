import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../../api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api("/auth/me");
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (payload, mode = "login") => {
    const { user } = await api(mode === "register" ? "/auth/register" : "/auth/login", { method: "POST", body: payload });
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    // full reload clears every page's old data from memory
    window.location.replace("/");
  };

  return <AuthCtx.Provider value={{ user, ready, login, logout, refresh, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
