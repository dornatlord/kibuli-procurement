import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { votes, subProgrammes, budgetItems, budgetAmounts } from "../db/schema.js";
import { and, eq, asc, getTableColumns, type SQL } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { thisYear } from "../lib/years.js";

const router = asyncRouter();

/** Budget lines with this year's amount as `budgetedAmount`, where one is set. */
const itemsWithThisYearsAmount = (where: SQL) =>
  db
    .select({ ...getTableColumns(budgetItems), budgetedAmount: budgetAmounts.amount })
    .from(budgetItems)
    .leftJoin(budgetAmounts, and(eq(budgetAmounts.budgetItemId, budgetItems.id), eq(budgetAmounts.year, thisYear())))
    .where(where)
    .orderBy(asc(budgetItems.displayOrder));

router.get("/votes", requireAuth, async (_req, res) => {
  const rows = await db.select().from(votes).orderBy(asc(votes.displayOrder));
  res.json(rows);
});

router.get("/votes/:voteId/sub-programmes", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(subProgrammes)
    .where(eq(subProgrammes.voteId, Number(req.params.voteId)))
    .orderBy(asc(subProgrammes.displayOrder));
  res.json(rows);
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
}

/**
 * Every budget line in one list, for pickers that need them all at once. A
 * sub-programme with no budget items of its own (the vote 2202 Tuition Stores
 * departments) is itself the line.
 */
router.get("/budget-lines", requireAuth, async (_req, res) => {
  const [allVotes, allSubs, allItems] = await Promise.all([
    db.select().from(votes).orderBy(asc(votes.displayOrder)),
    db.select().from(subProgrammes).orderBy(asc(subProgrammes.displayOrder)),
    db.select().from(budgetItems).orderBy(asc(budgetItems.displayOrder)),
  ]);

  const lines: BudgetLine[] = [];
  for (const v of allVotes) {
    const line = (
      kind: "bi" | "sp",
      id: number,
      name: string,
      subProgrammeName: string | null,
      priceCategories: string[] | null,
      supplyCode: string | null
    ): BudgetLine => ({
      key: `${kind}:${id}`,
      kind,
      id,
      name,
      voteCode: v.code,
      voteName: v.name,
      subProgrammeName,
      priceCategories: priceCategories ?? [],
      supplyCode,
    });

    const voteItems = allItems.filter((i) => i.voteId === v.id);
    for (const s of allSubs.filter((s) => s.voteId === v.id)) {
      const own = voteItems.filter((i) => i.subProgrammeId === s.id);
      if (own.length === 0) lines.push(line("sp", s.id, s.name, null, s.priceCategories, s.supplyCode));
      for (const i of own) lines.push(line("bi", i.id, i.name, s.name, i.priceCategories, i.supplyCode));
    }
    for (const i of voteItems.filter((i) => !i.subProgrammeId)) {
      lines.push(line("bi", i.id, i.name, null, i.priceCategories, i.supplyCode));
    }
  }
  res.json(lines);
});

export default router;
