import { api, ApiError, OfflineError } from "./api";

// Requests filled in without internet wait here, on this computer, until the
// server can be reached. Each carries a one-time id (clientRef), so a send
// whose reply is lost can be repeated without creating a second request.

export interface QueuedRequest {
  clientRef: string;
  queuedAt: string;
  /** Exactly what POST /requests receives. */
  payload: Record<string, unknown>;
  summary: {
    subject: string;
    procurementSize: string;
    itemCount: number;
    total: number | null;
  };
  /** Why the server refused it last time, if it did. */
  error?: string;
}

export interface SentRequest {
  id: number;
  referenceNumber: string | null;
  subject: string;
}

const OUTBOX_EVENT = "kibuli:outbox";
const key = (userId: number) => `kibuli:outbox:${userId}`;

export function queuedRequests(userId: number): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? "[]") as QueuedRequest[];
  } catch {
    return [];
  }
}

function write(userId: number, list: QueuedRequest[]) {
  if (list.length) localStorage.setItem(key(userId), JSON.stringify(list));
  else localStorage.removeItem(key(userId));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

/** Keep a request on this computer until it can be sent. Throws if storage is unavailable. */
export function queueRequest(userId: number, entry: QueuedRequest) {
  try {
    write(userId, [...queuedRequests(userId), entry]);
  } catch {
    throw new Error(
      "You're offline, and this computer couldn't keep the request (its browser storage is full or switched off)."
    );
  }
}

export function discardQueued(userId: number, clientRef: string) {
  write(userId, queuedRequests(userId).filter((q) => q.clientRef !== clientRef));
}

export function newClientRef(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Sent since the app opened, until the person dismisses the notice.
let recentlySent: SentRequest[] = [];
export const sentRequests = () => recentlySent;
export function dismissSent() {
  recentlySent = [];
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

/** Call `fn` whenever the waiting or sent requests change, here or in another window. */
export function onOutboxChange(fn: () => void) {
  window.addEventListener(OUTBOX_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(OUTBOX_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Send waiting requests, oldest first. Stops at the first sign the server can't be reached. */
export async function sendQueued(userId: number) {
  const run = async () => {
    for (const entry of queuedRequests(userId)) {
      try {
        const saved = await api.post<{ id: number; referenceNumber?: string }>("/requests", entry.payload);
        write(userId, queuedRequests(userId).filter((q) => q.clientRef !== entry.clientRef));
        recentlySent = [
          ...recentlySent,
          { id: saved.id, referenceNumber: saved.referenceNumber ?? null, subject: entry.summary.subject },
        ];
        window.dispatchEvent(new Event(OUTBOX_EVENT));
      } catch (err) {
        // Offline again, or signed out: try the rest later.
        if (err instanceof OfflineError || (err instanceof ApiError && err.status === 401)) return;
        const message = err instanceof Error ? err.message : "The server refused it";
        write(
          userId,
          queuedRequests(userId).map((q) => (q.clientRef === entry.clientRef ? { ...q, error: message } : q))
        );
      }
    }
  };
  // One sender at a time, even with the app open in several windows.
  if (navigator.locks) await navigator.locks.request(`kibuli-outbox-${userId}`, run);
  else await run();
}
