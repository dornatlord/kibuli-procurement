import { isServerReachable, reportServerReachable } from "./online";
import { copyOwner, readCopy, saveCopy } from "./savedCopies";

const BASE = import.meta.env.VITE_API_URL || "/api";

/** The request never reached the server: no internet, or the server can't be reached. */
export class OfflineError extends Error {
  constructor(message?: string) {
    super(
      message ??
        (navigator.onLine
          ? "Couldn't reach the server. Check the connection and try again."
          : "You're offline. Connect to the internet and try again.")
    );
    this.name = "OfflineError";
  }
}

/** The server answered, but with an error. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fired when the server turns a request away, so the app can check whether the login expired. */
export const UNAUTHORIZED_EVENT = "kibuli:unauthorized";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
      ...opts,
    });
  } catch {
    reportServerReachable(false);
    throw new OfflineError();
  }
  // Render answers these while the server is down or restarting.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    reportServerReachable(false);
    throw new OfflineError();
  }
  reportServerReachable(true);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Signing in and the login check answer 401 as part of their normal work.
    if (res.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(err.error || "Request failed", res.status);
  }
  return res.json();
}

// Searches change with every keystroke and the login check has its own
// fallback, so neither is worth keeping a copy of.
const keepsCopy = (path: string) => !path.startsWith("/auth/me") && !path.includes("/search");

/**
 * Reads come from the server when it can be reached, and otherwise from the
 * copy saved on this computer the last time they were loaded. Pass
 * `{ savedCopy: false }` to get an OfflineError instead of a saved copy.
 */
async function get<T>(path: string, options: { savedCopy?: boolean } = {}): Promise<T> {
  const owner = copyOwner();
  try {
    const data = await request<T>(path);
    if (keepsCopy(path)) void saveCopy(path, data, owner);
    return data;
  } catch (err) {
    if (!(err instanceof OfflineError) || !keepsCopy(path) || options.savedCopy === false) throw err;
    const copy = await readCopy<T>(path);
    if (copy) return copy.data;
    throw new OfflineError(
      `${navigator.onLine ? "Couldn't reach the server" : "You're offline"}, and this hasn't been saved on ` +
        "this computer yet. Open it once while online to keep a copy."
    );
  }
}

// While the server can't be reached, check again every 20 seconds and as soon
// as the computer reconnects, so waiting work goes out without a page reload.
async function checkServer() {
  if (!navigator.onLine || isServerReachable()) return;
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    if (res.ok) reportServerReachable(true);
  } catch {
    // Still unreachable; the next check will try again.
  }
}
setInterval(checkServer, 20000);
window.addEventListener("online", () => void checkServer());

export const api = {
  get,
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
