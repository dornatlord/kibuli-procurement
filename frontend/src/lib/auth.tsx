import React, { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError, UNAUTHORIZED_EVENT } from "./api";

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

// Who was last signed in on this device, so the installed app still opens
// without internet. It holds no password or session key, and the server
// checks the login again as soon as there's a connection.
const REMEMBERED_USER = "kibuli:user";

function recallUser(): User | null {
  try {
    const saved = localStorage.getItem(REMEMBERED_USER);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
}

function rememberUser(user: User | null) {
  try {
    if (user) localStorage.setItem(REMEMBERED_USER, JSON.stringify(user));
    else localStorage.removeItem(REMEMBERED_USER);
  } catch {
    // Storage can be switched off; the app just won't open offline.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const u = await api.get<User>("/auth/me");
      setUser(u);
      rememberUser(u);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        rememberUser(null);
      } else {
        // No connection, or the server is struggling: neither is a sign-out.
        setUser((current) => current ?? recallUser());
      }
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    // Check the login again when the connection returns, and whenever the
    // server turns a request away, in case the login has expired.
    const recheck = () => void refresh();
    window.addEventListener("online", recheck);
    window.addEventListener(UNAUTHORIZED_EVENT, recheck);
    return () => {
      window.removeEventListener("online", recheck);
      window.removeEventListener(UNAUTHORIZED_EVENT, recheck);
    };
  }, []);

  async function login(email: string, password: string) {
    const u = await api.post<User>("/auth/login", { email, password });
    setUser(u);
    rememberUser(u);
  }

  async function logout() {
    await api.post("/auth/logout", {});
    setUser(null);
    rememberUser(null);
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
