/**
 * The names, titles and dates a request's forms print, saved with the request
 * as the user entered them. Only these boxes are kept: anything else sent is
 * dropped, and each value is trimmed text (a date as YYYY-MM-DD, or blank).
 */

export const TFORM_KEYS = [
  "planReference",
  "requesterName",
  "requesterTitle",
  "requestedOn",
  "hodName",
  "hodTitle",
  "hodOn",
  "aoName",
  "aoTitle",
  "aoOn",
  "pduName",
  "pduTitle",
  "pduOn",
  "chairName",
  "chairOn",
  "secretaryName",
  "secretaryOn",
  "meetingOn",
] as const;

export const CALLOFF_KEYS = ["provider", "date", "authorisedName", "authorisedPosition"] as const;

const isDateKey = (k: string) => k === "date" || /On$/.test(k);

/** The saved boxes from what was sent, or a message saying what's wrong. */
export function cleanDetails(raw: unknown, keys: readonly string[]): Record<string, string> | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return "The form details must be a list of boxes.";
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const text = String(v ?? "").trim().slice(0, 300);
    if (isDateKey(k) && text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${k} must be a date.`;
    out[k] = text;
  }
  return out;
}
