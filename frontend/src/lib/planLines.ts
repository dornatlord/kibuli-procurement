import type { ComboOption } from "../components/Combobox";

/** A line of the school's procurement plan, as the request forms offer it. */
export interface PlanLine {
  id: number;
  /** The school's reference, e.g. "KSS/SUPLS/26/003". */
  reference: string | null;
  subjectOfProcurement: string;
  procurementCategory: string | null;
  procurementMethod: string | null;
  estimatedCost: string | null;
}

/** GET /procurement-plan/lines: the year's lines, and the reference each budget line last used. */
export interface PlanLines {
  lines: PlanLine[];
  lastUsed: Record<string, string>;
}

/**
 * The plan's references as choices, each with what it is for. The school's
 * plan uses a few references twice, so those show both subjects.
 */
export function planOptions(lines: PlanLine[]): ComboOption[] {
  const byRef = new Map<string, PlanLine[]>();
  for (const l of lines) {
    if (!l.reference) continue;
    byRef.set(l.reference, [...(byRef.get(l.reference) ?? []), l]);
  }
  return [...byRef].map(([reference, same]) => ({
    value: reference,
    label: `${reference} — ${same.map((l) => l.subjectOfProcurement).join("; ")}`,
    hint: [...new Set(same.map((l) => l.procurementMethod).filter(Boolean))].join("; ") || undefined,
  }));
}

const SKIP = new Set([
  "and", "the", "for", "with", "from", "etc", "other", "general", "new", "supply", "supplies", "purchase",
  "school", "service", "services", "item", "items", "material", "materials", "office",
]);

/**
 * The words that say what a line is for: "Bed Repairs" → bed, repair. Two
 * words written apart also count as one ("TEXT BOOKS" is textbook too).
 */
function words(text: string): Set<string> {
  const list = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 3 && !SKIP.has(w));
  return new Set([...list, ...list.slice(1).map((w, i) => list[i] + w)]);
}

/**
 * The same word with one letter left out or added: "Photograpy" for
 * photography, "Ramadhan" for Ramadan, "IDDI" for IDD. Short words only match
 * by a letter added at the end.
 */
function nearly(a: string, b: string) {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (long.length !== short.length + 1) return false;
  if (short.length < 6) return long.startsWith(short);
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

/** "supplies" → SUPLS: the category part of the plan's references. */
const CODES: Record<string, string> = { supplies: "SUPLS", works: "WORKS", non_consultancy: "SERVS" };

/**
 * The plan reference a new request most likely belongs to: the one its budget
 * line used last time, or else the plan line whose subject best matches the
 * budget line and the subject. A word found in few plan lines counts for more
 * than one found in many ("kitchen" over "equipment"). None when no line
 * clearly stands out, so a guess is never passed off as the answer.
 */
export function suggestPlanReference(
  plan: PlanLines | null,
  { lineKey, lineName, subject, category }: { lineKey: string | null; lineName: string | null; subject: string; category: string }
): string | null {
  if (!plan?.lines.length) return null;
  if (lineKey && plan.lastUsed[lineKey]) return plan.lastUsed[lineKey];

  const wanted = [...words(`${lineName ?? ""} ${subject}`)];
  if (wanted.length === 0) return null;
  const lines = plan.lines.filter((l) => l.reference).map((l) => ({ reference: l.reference!, have: [...words(l.subjectOfProcurement)] }));
  const has = (have: string[], w: string) => have.some((h) => nearly(h, w));
  // How many plan lines each wanted word turns up in.
  const spread = new Map(wanted.map((w) => [w, lines.filter((l) => has(l.have, w)).length]));
  const code = CODES[category];

  const scored = lines
    .map((l) => {
      const score = wanted.reduce((s, w) => s + (has(l.have, w) ? 1 / (spread.get(w) || 1) : 0), 0);
      // Sharing the request's category settles a tie between otherwise equal lines.
      return { reference: l.reference, score: score && score + (code && l.reference.includes(`/${code}/`) ? 0.25 : 0) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const [best, next] = scored;
  if (next && next.reference !== best.reference && best.score - next.score < 0.25) return null;
  return best.reference;
}
