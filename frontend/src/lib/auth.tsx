import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

interface User {
  id: number;
  email?: string;
  name: string;
  role: string;
  roleLabel?: string;
  department: string | null;
  mustChangePassword?: boolean;
  permissions?: string[];
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** True when the signed-in user holds ANY of the given permissions. */
  can: (...permissions: string[]) => boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const u = await api.get<User>("/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const u = await api.post<User>("/auth/login", { email, password });
    setUser(u);
  }

  async function logout() {
    await api.post("/auth/logout", {});
    setUser(null);
  }

  function can(...permissions: string[]) {
    if (!user) return false;
    if (user.role === "administrator") return true;
    const held = user.permissions ?? [];
    return permissions.some((p) => held.includes(p));
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refresh, can }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
