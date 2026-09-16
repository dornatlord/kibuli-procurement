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
