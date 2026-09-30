import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs, users } from "../db/schema.js";

// Correcting a saved record. Records aren't locked, but only the people allowed
// to correct them may (requireCorrectionRight), and every correction goes in
// the audit trail with why, and what changed from what to what.

/** An item line as a correction sends it: one already saved (with its id), or a new one. */
export interface LineIn {
  id?: number;
  description: string;
  quantity: number;
  unitOfMeasure: string | null;
  unitPrice: number;
}

/** A saved item line, for comparing with what's sent. */
export interface LineNow {
  id: number;
  description: string;
  quantity: string | number | null;
  unitOfMeasure: string | null;
  unitPrice: string | number | null;
}

const number = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));

/** Reads the item lines sent with a correction, or says what's wrong with them. */
export function readLines(raw: unknown): LineIn[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Keep at least one item.";
  if (raw.length > 200) return "That's more items than one record can hold.";
  const lines: LineIn[] = [];
  for (const [i, r] of raw.entries()) {
    const src = (r ?? {}) as Record<string, unknown>;
    const description = String(src.description ?? "").trim().slice(0, 500);
    const quantity = number(src.quantity);
    const unitPrice = number(src.unitPrice);
    if (!description) return `Item ${i + 1} needs a description.`;
    if (!Number.isFinite(quantity) || quantity <= 0) return `Item ${i + 1} needs a quantity above 0.`;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return `Item ${i + 1} needs a unit price of 0 or more.`;
    const id = Number(src.id);
    lines.push({
      id: Number.isInteger(id) && id > 0 ? id : undefined,
      description,
      quantity,
      unitOfMeasure: String(src.unitOfMeasure ?? "").trim().slice(0, 50) || null,
      unitPrice,
    });
  }
  return lines;
}

/** "2026-09-24", null when left blank, undefined when it isn't a real date. */
export function dateFrom(v: unknown): string | null | undefined {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : undefined;
}

/** A text field's value: trimmed, and null when blank. */
export function textFrom(v: unknown, max = 500): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}

/** Two values the same for the record? Numbers by value ("15000.00" is 15000), the rest as text. */
function same(a: unknown, b: unknown) {
  const blank = (v: unknown) => v === null || v === undefined || v === "";
  if (blank(a) || blank(b)) return blank(a) && blank(b);
  const x = Number(a);
  const y = Number(b);
  if (typeof a !== "boolean" && Number.isFinite(x) && Number.isFinite(y) && String(a).trim() !== "" && String(b).trim() !== "") return x === y;
  return String(a) === String(b);
}

/** The fields that differ, as { field, from, to }. */
export function changesBetween(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after)
    .filter((k) => !same(before[k], after[k]))
    .map((k) => ({ field: k, from: before[k] ?? null, to: after[k] ?? null }));
}

/** Which item lines were added, removed or changed, and how. */
export function lineChanges(now: LineNow[], sent: LineIn[]) {
  const byId = new Map(now.map((l) => [l.id, l]));
  const kept = new Set(sent.filter((l) => l.id && byId.has(l.id)).map((l) => l.id));
  const changed: { item: string; changes: string[] }[] = [];
  for (const l of sent) {
    const was = l.id ? byId.get(l.id) : undefined;
    if (!was) continue;
    const diffs: string[] = [];
    if (was.description !== l.description) diffs.push(`description "${was.description}" → "${l.description}"`);
    if (!same(was.quantity, l.quantity)) diffs.push(`quantity ${Number(was.quantity)} → ${l.quantity}`);
    if (!same(was.unitOfMeasure, l.unitOfMeasure)) diffs.push(`unit "${was.unitOfMeasure ?? ""}" → "${l.unitOfMeasure ?? ""}"`);
    if (!same(was.unitPrice, l.unitPrice)) diffs.push(`unit price ${Number(was.unitPrice)} → ${l.unitPrice}`);
    if (diffs.length) changed.push({ item: l.description, changes: diffs });
  }
  return {
    added: sent.filter((l) => !l.id || !byId.has(l.id)).map((l) => l.description),
    removed: now.filter((l) => !kept.has(l.id)).map((l) => l.description),
    changed,
  };
}

export const nothingChanged = (changes: unknown[], lines: ReturnType<typeof lineChanges>) =>
  !changes.length && !lines.added.length && !lines.removed.length && !lines.changed.length;

/** A record's corrections, newest first: when, by whom, and why. */
export async function correctionsOf(entityType: string, entityId: number, action: string) {
  const rows = await db
    .select({ at: auditLogs.createdAt, by: users.name, details: auditLogs.details })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId), eq(auditLogs.action, action)))
    .orderBy(desc(auditLogs.id));
  return rows.map((r) => ({ at: r.at, by: r.by, reason: ((r.details ?? {}) as { reason?: string }).reason ?? null }));
}
