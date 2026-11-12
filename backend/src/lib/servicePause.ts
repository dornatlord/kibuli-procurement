import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";

/** The settings row the owner's control tool writes. The school's own settings pages can't reach it. */
export const SERVICE_PAUSE_KEY = "service_pause";

interface Stored {
  /** When access stops. Set, it also starts the warning shown to everyone now. */
  pauseAt?: string | null;
  /** Said on the "paused" screen and in the warning. */
  message?: string | null;
  contact?: string | null;
  /** A one-day (or longer) reminder, shown from `from` to `to` (YYYY-MM-DD, Kampala dates). */
  notice?: { text: string; from: string; to: string } | null;
}

export type ServiceState =
  | { state: "ok" }
  | { state: "notice"; text: string; contact: string | null }
  | { state: "warning"; pauseAt: string; minutesLeft: number; message: string; contact: string | null }
  | { state: "paused"; message: string; contact: string | null };

const DEFAULT_MESSAGE = "Access to this system is paused because a payment to the system provider is outstanding.";

const kampalaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(d);

let cache: { at: number; value: Stored } | null = null;

async function load(): Promise<Stored> {
  if (cache && Date.now() - cache.at < 8000) return cache.value;
  let value: Stored = {};
  try {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SERVICE_PAUSE_KEY));
    value = (row?.value as Stored) ?? {};
  } catch {
    // A failed read must never lock the school out by accident: carry on with the last known state.
    if (cache) return cache.value;
  }
  cache = { at: Date.now(), value };
  return value;
}

/** What the school should see right now, from the stored settings. */
export async function serviceState(now = new Date()): Promise<ServiceState> {
  const s = await load();
  const message = s.message?.trim() || DEFAULT_MESSAGE;
  const contact = s.contact?.trim() || null;
  if (s.pauseAt) {
    const at = new Date(s.pauseAt);
    if (!Number.isNaN(at.getTime())) {
      if (now >= at) return { state: "paused", message, contact };
      return { state: "warning", pauseAt: at.toISOString(), minutesLeft: Math.ceil((at.getTime() - now.getTime()) / 60000), message, contact };
    }
  }
  const n = s.notice;
  if (n?.text?.trim() && n.from && n.to) {
    const today = kampalaDay(now);
    if (today >= n.from && today <= n.to) return { state: "notice", text: n.text.trim(), contact };
  }
  return { state: "ok" };
}
