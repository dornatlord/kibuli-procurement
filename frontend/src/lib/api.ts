const BASE = import.meta.env.VITE_API_URL || "/api";

/** The request never reached the server: no internet, or the server can't be reached. */
export class OfflineError extends Error {
  constructor() {
    super(
      navigator.onLine
        ? "Couldn't reach the server. Check the connection and try again."
        : "You're offline. Connect to the internet and try again."
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
    throw new OfflineError();
  }
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

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
