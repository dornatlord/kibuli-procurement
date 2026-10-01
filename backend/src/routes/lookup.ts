import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { votes, subProgrammes, budgetItems, budgetAmounts } from "../db/schema.js";
import { and, eq, asc, getTableColumns, type SQL } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { thisYear } from "../lib/years.js";
import { linesOfVote, numberLines } from "../lib/budgetLines.js";

const router = asyncRouter();

/**
 * Budget lines with this year's amount as `budgetedAmount`, where one is set,
 * and `lineNumber`, the line's number in its vote (2201-5 is line 5 of 2201).
 */
async function itemsWithThisYearsAmount(where: SQL) {
  const rows = await db
    .select({ ...getTableColumns(budgetItems), budgetedAmount: budgetAmounts.amount })
    .from(budgetItems)
    .leftJoin(budgetAmounts, and(eq(budgetAmounts.budgetItemId, budgetItems.id), eq(budgetAmounts.year, thisYear())))
    .where(where)
    .orderBy(asc(budgetItems.displayOrder), asc(budgetItems.id));
  if (rows.length === 0) return [];
  const numbers = new Map<number, number>();
  for (const l of await linesOfVote(rows[0].voteId)) if (l.kind === "bi") numbers.set(l.item.id, l.number);
  return rows.map((r) => ({ ...r, lineNumber: numbers.get(r.id) ?? null }));
}

router.get("/votes", requireAuth, async (_req, res) => {
  const rows = await db.select().from(votes).orderBy(asc(votes.displayOrder));
  res.json(rows);
});

router.get("/votes/:voteId/sub-programmes", requireAuth, async (req, res) => {
  const voteId = Number(req.params.voteId);
  const rows = await db
    .select()
    .from(subProgrammes)
    .where(eq(subProgrammes.voteId, voteId))
    .orderBy(asc(subProgrammes.displayOrder), asc(subProgrammes.id));
  // A sub-programme with no items of its own is a line itself, with a number.
  const numbers = new Map<number, number>();
  for (const l of await linesOfVote(voteId)) if (l.kind === "sp") numbers.set(l.sub.id, l.number);
  res.json(rows.map((r) => ({ ...r, lineNumber: numbers.get(r.id) ?? null })));
});

router.get("/sub-programmes/:subId/items", requireAuth, async (req, res) => {
  res.json(await itemsWithThisYearsAmount(eq(budgetItems.subProgrammeId, Number(req.params.subId))));
});

router.get("/votes/:voteId/items", requireAuth, async (req, res) => {
  // For votes with no sub-programme
  res.json(await itemsWithThisYearsAmount(eq(budgetItems.voteId, Number(req.params.voteId))));
});

interface BudgetLine {
  key: string;
  kind: "bi" | "sp";
  id: number;
  name: string;
  voteCode: string;
  voteName: string;
  subProgrammeName: string | null;
  priceCategories: string[];
  supplyCode: string | null;
  /** The line's number in its vote, counted straight through it (2201-5). */
  number: number;
}

/**
 * Every budget line in one list, for pickers that need them all at once. A
 * sub-programme with no budget items of its own (the vote 2202 Tuition Stores
 * departments) is itself the line.
 */
router.get("/budget-lines", requireAuth, async (_req, res) => {
  const [allVotes, allSubs, allItems] = await Promise.all([
    db.select().from(votes).orderBy(asc(votes.displayOrder)),
    db.select().from(subProgrammes),
    db.select().from(budgetItems),
  ]);

  const lines: BudgetLine[] = [];
  for (const v of allVotes) {
    const numbered = numberLines(
      allSubs.filter((s) => s.voteId === v.id),
      allItems.filter((i) => i.voteId === v.id)
    );
    for (const l of numbered) {
      const own = l.kind === "sp" ? l.sub : l.item;
      lines.push({
        key: `${l.kind}:${own.id}`,
        kind: l.kind,
        id: own.id,
        name: own.name,
        voteCode: v.code,
        voteName: v.name,
        subProgrammeName: l.kind === "bi" ? l.sub?.name ?? null : null,
        priceCategories: own.priceCategories ?? [],
        supplyCode: own.supplyCode,
        number: l.number,
      });
    }
  }
  res.json(lines);
});

export default router;
