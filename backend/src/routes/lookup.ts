import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { votes, subProgrammes, budgetItems } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = asyncRouter();

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
  const rows = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.subProgrammeId, Number(req.params.subId)))
    .orderBy(asc(budgetItems.displayOrder));
  res.json(rows);
});

router.get("/votes/:voteId/items", requireAuth, async (req, res) => {
  // For votes with no sub-programme
  const rows = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.voteId, Number(req.params.voteId)))
    .orderBy(asc(budgetItems.displayOrder));
  res.json(rows);
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
