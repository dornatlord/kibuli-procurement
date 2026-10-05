import { db } from "../db/index.js";
import { budgetItems, subProgrammes, votes } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * What a procurement request must have before it can be saved, sent on for
 * approval or printed: everything TFORM 5 prints that only the person raising
 * the request can supply. A request saved without its programme printed
 * Part III blank, so nothing that the form needs is left optional any more.
 *
 * The plan line (TFORM 5 prints the request's own reference), the balance
 * remaining (the Accounting Officer confirms funds) and Part II (the PDU's)
 * are filled in by others, later, and aren't asked for here.
 */

/** Part III's budget line, taken from the most specific choice. */
export interface BudgetLine {
  voteId: number | null;
  subProgrammeId: number | null;
  budgetItemId: number | null;
  supplyCode: string | null;
}

const idFrom = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * The budget line a choice of vote, sub-programme and budget item comes to,
 * and what is still to be chosen. A line is a budget item, or a sub-programme
 * with no items of its own (the vote 2202 Tuition Stores departments). The
 * vote and sub-programme always come from the line itself, so they can't
 * disagree with it.
 */
export async function budgetLineOf(raw: { voteId?: unknown; subProgrammeId?: unknown; budgetItemId?: unknown }): Promise<{
  line: BudgetLine;
  missing: string[];
}> {
  const none: BudgetLine = { voteId: null, subProgrammeId: null, budgetItemId: null, supplyCode: null };
  const bi = idFrom(raw.budgetItemId);
  if (bi) {
    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, bi));
    if (item) {
      return {
        line: { voteId: item.voteId, subProgrammeId: item.subProgrammeId, budgetItemId: item.id, supplyCode: item.supplyCode },
        missing: [],
      };
    }
  }
  const sp = idFrom(raw.subProgrammeId);
  if (sp) {
    const [sub] = await db.select().from(subProgrammes).where(eq(subProgrammes.id, sp));
    if (sub) {
      const [anyItem] = await db.select({ id: budgetItems.id }).from(budgetItems).where(eq(budgetItems.subProgrammeId, sub.id)).limit(1);
      return anyItem
        ? { line: { ...none, voteId: sub.voteId, subProgrammeId: sub.id }, missing: ["Budget item"] }
        : { line: { voteId: sub.voteId, subProgrammeId: sub.id, budgetItemId: null, supplyCode: sub.supplyCode }, missing: [] };
    }
  }
  const vt = idFrom(raw.voteId);
  if (vt) {
    const [vote] = await db.select({ id: votes.id }).from(votes).where(eq(votes.id, vt));
    if (vote) {
      const [anySub] = await db.select({ id: subProgrammes.id }).from(subProgrammes).where(eq(subProgrammes.voteId, vote.id)).limit(1);
      return { line: { ...none, voteId: vote.id }, missing: [anySub ? "Sub-programme" : "Budget item"] };
    }
  }
  return { line: none, missing: ["Programme (vote)"] };
}

export interface ItemIn {
  description?: unknown;
  quantity?: unknown;
  unitOfMeasure?: unknown;
  estimatedUnitCost?: unknown;
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
const positive = (v: unknown) => !blank(v) && Number.isFinite(Number(v)) && Number(v) > 0;
const isDate = (v: unknown) => {
  if (blank(v)) return false;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Everything else the form needs, by its label on the form. */
export function missingDetails(r: {
  subjectOfProcurement?: unknown;
  dateRequired?: unknown;
  locationForDelivery?: unknown;
  weekNumber?: unknown;
  term?: unknown;
  items?: ItemIn[] | null;
}): string[] {
  const missing: string[] = [];
  if (blank(r.weekNumber)) missing.push("Week");
  if (blank(r.term)) missing.push("Term");
  if (blank(r.subjectOfProcurement)) missing.push("Subject of procurement");
  if (blank(r.locationForDelivery)) missing.push("Location for delivery");
  if (!isDate(r.dateRequired)) missing.push("Date required");
  const items = (r.items ?? []).filter((it) => !blank(it.description) || positive(it.quantity) || positive(it.estimatedUnitCost));
  if (items.length === 0) missing.push("At least one item");
  items.forEach((it, i) => {
    const gaps = [
      blank(it.description) && "description",
      !positive(it.quantity) && "quantity",
      blank(it.unitOfMeasure) && "unit",
      !positive(it.estimatedUnitCost) && "unit cost",
    ].filter(Boolean);
    if (gaps.length) missing.push(`Item ${i + 1}: ${gaps.join(", ")}`);
  });
  return missing;
}

/** The message shown when something is missing. */
export function missingMessage(missing: string[]) {
  return `Fill these in first: ${missing.join("; ")}.`;
}
