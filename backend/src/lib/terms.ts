import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";

/** A school term: the whole months it covers, which FORM 27 reports as its quarter. */
export interface SchoolTerm {
  term: number;
  startMonth: number;
  endMonth: number;
}

export const TERMS_KEY = "school_terms";

/** Kibuli's filled Term 1 2026 return covers January to April. */
export const DEFAULT_TERMS: SchoolTerm[] = [
  { term: 1, startMonth: 1, endMonth: 4 },
  { term: 2, startMonth: 5, endMonth: 8 },
  { term: 3, startMonth: 9, endMonth: 12 },
];

/**
 * Checks terms sent from the settings screen: all three, whole months 1–12,
 * each ending no earlier than it starts and before the next one begins.
 * Months left out of every term are allowed.
 */
export function validateTerms(raw: unknown): { terms: SchoolTerm[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length !== 3) return { error: "Give the months for all three terms." };
  const month = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
  };
  const terms: SchoolTerm[] = [];
  for (let i = 0; i < 3; i++) {
    const t = (raw[i] ?? {}) as Record<string, unknown>;
    const startMonth = month(t.startMonth);
    const endMonth = month(t.endMonth);
    if (startMonth === null || endMonth === null) return { error: `Term ${i + 1} needs a start and end month.` };
    if (endMonth < startMonth) return { error: `Term ${i + 1} ends before it starts.` };
    if (i > 0 && startMonth <= terms[i - 1].endMonth) {
      return { error: `Term ${i + 1} starts before Term ${i} has ended.` };
    }
    terms.push({ term: i + 1, startMonth, endMonth });
  }
  return { terms };
}

export async function getTerms(): Promise<SchoolTerm[]> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, TERMS_KEY));
  if (!row) return DEFAULT_TERMS;
  const checked = validateTerms(row.value);
  return "terms" in checked ? checked.terms : DEFAULT_TERMS;
}

/** The term's first day and the first day after it, as YYYY-MM-DD. */
export function termRange(year: number, t: SchoolTerm) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(t.startMonth)}-01`,
    end: t.endMonth === 12 ? `${year + 1}-01-01` : `${year}-${pad(t.endMonth + 1)}-01`,
  };
}

/** A moment's date in Kampala (the server runs on UTC). */
function kampalaDate(at: Date) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" })
    .format(at)
    .split("-")
    .map(Number);
  return { year, month, day };
}

/**
 * The term and the week of the term a date falls in, as FORM 5 prints them:
 * "Week 5, Term 3". The term is the one whose months hold the date; in a
 * holiday month, the term that has just ended. Week 1 is the school week
 * (Monday to Sunday) holding the 1st of the term's first month. The person
 * raising a request can change both before saving.
 */
export function termAndWeek(terms: SchoolTerm[], at: Date): { term: number; week: number } {
  const { year, month, day } = kampalaDate(at);
  const t =
    terms.find((x) => month >= x.startMonth && month <= x.endMonth) ??
    [...terms].reverse().find((x) => x.startMonth <= month) ??
    terms[0];
  const start = Date.UTC(year, t.startMonth - 1, 1);
  const days = Math.round((Date.UTC(year, month - 1, day) - start) / 86400000);
  const mondayOffset = (new Date(start).getUTCDay() + 6) % 7;
  return { term: t.term, week: days < 0 ? 1 : Math.floor((days + mondayOffset) / 7) + 1 };
}

/** A week or term typed on the form, if it is a sensible one. */
export function wholeNumberIn(value: unknown, low: number, high: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= low && n <= high ? n : null;
}
