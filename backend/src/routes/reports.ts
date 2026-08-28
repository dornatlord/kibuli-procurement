import { Router } from "express";
import { db } from "../db/index.js";
import {
  procurementRequests,
  votes,
  budgetItems,
  purchaseOrders,
  suppliers,
  contracts,
} from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";

const router = Router();

router.get("/summary", requirePermission("reports.view"), async (_req, res) => {
  const byStatus = await db
    .select({ status: procurementRequests.status, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .groupBy(procurementRequests.status);

  const byCategory = await db
    .select({ category: procurementRequests.category, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .groupBy(procurementRequests.category);

  const bySize = await db
    .select({ size: procurementRequests.procurementSize, count: sql<number>`count(*)`, total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)` })
    .from(procurementRequests)
    .groupBy(procurementRequests.procurementSize);

  const [totals] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(estimated_total_cost), 0)`,
    })
    .from(procurementRequests);

  res.json({ totals, byStatus, byCategory, bySize });
});

router.get("/budget-utilization", requirePermission("reports.view"), async (_req, res) => {
  const rows = await db
    .select({
      voteId: votes.id,
      voteCode: votes.code,
      voteName: votes.name,
      budgeted: sql<string>`COALESCE(SUM(${budgetItems.budgetedAmount}), 0)`,
    })
    .from(votes)
    .leftJoin(budgetItems, eq(budgetItems.voteId, votes.id))
    .groupBy(votes.id, votes.code, votes.name)
    .orderBy(votes.displayOrder);

  const spent = await db
    .select({
      voteId: procurementRequests.voteId,
      spent: sql<string>`COALESCE(SUM(estimated_total_cost), 0)`,
    })
    .from(procurementRequests)
    .where(eq(procurementRequests.status, "approved"))
    .groupBy(procurementRequests.voteId);

  const spentByVote = new Map(spent.map((s) => [s.voteId, s.spent]));

  res.json(
    rows.map((r) => ({
      ...r,
      spent: spentByVote.get(r.voteId) ?? "0",
    }))
  );
});

router.get("/top-suppliers", requirePermission("reports.view"), async (_req, res) => {
  const fromOrders = await db
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      poCount: sql<number>`count(distinct ${purchaseOrders.id})`,
      poTotal: sql<string>`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`,
    })
    .from(suppliers)
    .leftJoin(purchaseOrders, eq(purchaseOrders.supplierId, suppliers.id))
    .groupBy(suppliers.id, suppliers.name)
    .having(sql`count(${purchaseOrders.id}) > 0`)
    .orderBy(desc(sql`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`))
    .limit(15);

  res.json(fromOrders);
});

export default router;
