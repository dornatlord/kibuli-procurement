import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  procurementRequests,
  votes,
  budgetItems,
  budgetAmounts,
  purchaseOrders,
  suppliers,
} from "../db/schema.js";
import { and, eq, sql, desc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { thisYear, yearFrom } from "../lib/years.js";

const router = asyncRouter();

// Every report is for one year (?year=, this year if not given), so a new year
// starts from nothing and an old one reads the same as it always did.

/** The years there's anything to report on, newest first, this year always among them. */
router.get("/years", requirePermission("reports.view"), async (_req, res) => {
  const rows = await db.execute<{ year: number }>(sql`
    select year from procurement_requests
    union select year from purchase_orders
    union select year from budget_amounts`);
  const years = new Set<number>([thisYear(), ...Array.from(rows, (r) => Number(r.year))]);
  res.json([...years].sort((a, b) => b - a));
});

router.get("/summary", requirePermission("reports.view"), async (req, res) => {
  const year = yearFrom(req.query.year) ?? thisYear();
  const ofYear = eq(procurementRequests.year, year);
  const byStatus = await db
    .select({ status: procurementRequests.status, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .where(ofYear)
    .groupBy(procurementRequests.status);

  const byCategory = await db
    .select({ category: procurementRequests.category, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .where(ofYear)
    .groupBy(procurementRequests.category);

  const bySize = await db
    .select({ size: procurementRequests.procurementSize, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .where(ofYear)
    .groupBy(procurementRequests.procurementSize);

  const [totals] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)`,
    })
    .from(procurementRequests)
    .where(ofYear);

  res.json({ year, totals, byStatus, byCategory, bySize });
});

/** Each vote's budget for the year against what the year's approved requests spend. */
router.get("/budget-utilization", requirePermission("reports.view"), async (req, res) => {
  const year = yearFrom(req.query.year) ?? thisYear();
  const rows = await db
    .select({
      voteId: votes.id,
      voteCode: votes.code,
      voteName: votes.name,
      budgeted: sql<string>`COALESCE(SUM(${budgetAmounts.amount}), 0)`,
    })
    .from(votes)
    .leftJoin(budgetItems, eq(budgetItems.voteId, votes.id))
    .leftJoin(budgetAmounts, and(eq(budgetAmounts.budgetItemId, budgetItems.id), eq(budgetAmounts.year, year)))
    .groupBy(votes.id, votes.code, votes.name)
    .orderBy(votes.displayOrder);

  const spent = await db
    .select({
      voteId: procurementRequests.voteId,
      spent: sql<string>`COALESCE(SUM(estimated_total_cost), 0)`,
    })
    .from(procurementRequests)
    .where(and(eq(procurementRequests.status, "approved"), eq(procurementRequests.year, year)))
    .groupBy(procurementRequests.voteId);

  const spentByVote = new Map(spent.map((s) => [s.voteId, s.spent]));

  res.json(
    rows.map((r) => ({
      ...r,
      spent: spentByVote.get(r.voteId) ?? "0",
    }))
  );
});

router.get("/top-suppliers", requirePermission("reports.view"), async (req, res) => {
  const year = yearFrom(req.query.year) ?? thisYear();
  const fromOrders = await db
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      poCount: sql<number>`count(distinct ${purchaseOrders.id})`,
      poTotal: sql<string>`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`,
    })
    .from(suppliers)
    .leftJoin(purchaseOrders, and(eq(purchaseOrders.supplierId, suppliers.id), eq(purchaseOrders.year, year)))
    .groupBy(suppliers.id, suppliers.name)
    .having(sql`count(${purchaseOrders.id}) > 0`)
    .orderBy(desc(sql`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`))
    .limit(15);

  res.json(fromOrders);
});

export default router;
