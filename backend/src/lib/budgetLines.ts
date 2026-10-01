import { db } from "../db/index.js";
import { subProgrammes, budgetItems } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface Ordered {
  id: number;
  displayOrder: number | null;
}

const inOrder = (a: Ordered, b: Ordered) => {
  if (a.displayOrder !== b.displayOrder) {
    if (a.displayOrder === null) return 1;
    if (b.displayOrder === null) return -1;
    return a.displayOrder - b.displayOrder;
  }
  return a.id - b.id;
};

export type NumberedLine<S, I> =
  | { kind: "sp"; number: number; sub: S }
  | { kind: "bi"; number: number; item: I; sub: S | null };

/**
 * A vote's budget lines in order, numbered the way the school numbers them:
 * straight through the vote, ignoring the roman-numeral sub-programmes. So
 * 2201-1 is Legal fees, the first item under (i) Professional fees, and 2201-5
 * is BOG training & development, the third under (ii) Board. A sub-programme
 * with no items of its own (the 2202 departments) is a line itself, and a vote
 * with no sub-programmes numbers its items in order (2208-3, Cultural days).
 * The budget's lines are seeded and nothing adds or reorders them, so a form
 * printed again years later shows the same numbers.
 */
export function numberLines<S extends Ordered, I extends Ordered & { subProgrammeId: number | null }>(
  subs: S[],
  items: I[]
): NumberedLine<S, I>[] {
  const lines: NumberedLine<S, I>[] = [];
  for (const sub of [...subs].sort(inOrder)) {
    const own = items.filter((i) => i.subProgrammeId === sub.id).sort(inOrder);
    if (own.length === 0) lines.push({ kind: "sp", number: lines.length + 1, sub });
    for (const item of own) lines.push({ kind: "bi", number: lines.length + 1, item, sub });
  }
  const subIds = new Set(subs.map((s) => s.id));
  for (const item of items.filter((i) => i.subProgrammeId === null || !subIds.has(i.subProgrammeId)).sort(inOrder)) {
    lines.push({ kind: "bi", number: lines.length + 1, item, sub: null });
  }
  return lines;
}

/** The vote's lines, numbered, read from the database. */
export async function linesOfVote(voteId: number) {
  const [subs, items] = await Promise.all([
    db.select().from(subProgrammes).where(eq(subProgrammes.voteId, voteId)),
    db.select().from(budgetItems).where(eq(budgetItems.voteId, voteId)),
  ]);
  return numberLines(subs, items);
}

/**
 * The number of the line a request spends: its budget item, or its
 * sub-programme when that has no items of its own. Null when a sub-programme
 * with items was chosen without picking one of them.
 */
export async function lineNumberOf(voteId: number, subProgrammeId: number | null, budgetItemId: number | null) {
  const lines = await linesOfVote(voteId);
  const line = budgetItemId
    ? lines.find((l) => l.kind === "bi" && l.item.id === budgetItemId)
    : lines.find((l) => l.kind === "sp" && l.sub.id === subProgrammeId);
  return line?.number ?? null;
}
