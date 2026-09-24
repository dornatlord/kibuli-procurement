/**
 * Slows down password guessing. Counts tries in a window, per address and per
 * account, and kept in memory: this runs as a single instance, and a restart
 * only forgives attempts.
 */
interface Window {
  tries: number;
  until: number;
}

const windows = new Map<string, Window>();

/** Seconds to wait, or 0 when the try is allowed. Counts the try. */
export function throttle(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  if (windows.size > 5000) for (const [k, w] of windows) if (w.until <= now) windows.delete(k);

  const open = windows.get(key);
  if (!open || open.until <= now) {
    windows.set(key, { tries: 1, until: now + windowMs });
    return 0;
  }
  open.tries += 1;
  return open.tries > limit ? Math.ceil((open.until - now) / 1000) : 0;
}

/** Forgets the tries once someone signs in. */
export function forget(...keys: string[]) {
  for (const key of keys) windows.delete(key);
}

/** "3 minutes", "45 seconds" — for the message shown to whoever is locked out. */
export function inWords(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return seconds >= 60 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${seconds} seconds`;
}
