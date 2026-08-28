import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  procurementRequests,
  contracts,
  contractAmendments,
  suppliers,
  auditLogs,
  procurementItems,
} from "../db/schema.js";
import { eq, and, gte, lt, inArray, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";

const router = asyncRouter();

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/**
 * Best-effort mapping of our data model onto PPDA FORM 2's four parts. Where
 * this system has no dedicated field (e.g. bid price at opening), the column
 * is left blank rather than guessed — matches how these forms are actually
 * filled in practice when a figure isn't on file yet.
 */
router.get("/", requirePermission("reports.view"), async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const { start, end } = monthRange(year, month);

  // Part I — contracts awarded this month, excluding micro procurements
  const partI = await db
    .select({
      referenceNumber: procurementRequests.referenceNumber,
      subject: procurementRequests.subjectOfProcurement,
      category: procurementRequests.category,
      dateOfAward: procurementRequests.updatedAt,
      marketPrice: procurementRequests.estimatedTotalCost,
      contractValue: contracts.contractValue,
      providerName: suppliers.name,
      providerCategory: suppliers.providerCategory,
      targetGroup: suppliers.targetGroup,
      ownerNames: suppliers.ownerNames,
    })
    .from(procurementRequests)
    .leftJoin(contracts, eq(contracts.procurementRequestId, procurementRequests.id))
    .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
    .where(
      and(
        eq(procurementRequests.status, "approved"),
        eq(procurementRequests.procurementSize, "macro"),
        gte(procurementRequests.updatedAt, start),
        lt(procurementRequests.updatedAt, end)
      )
    );

  // Part II — contract amendments recorded this month
  const partII = await db
    .select({
      contractNumber: contracts.contractNumber,
      subject: contracts.title,
      providerName: suppliers.name,
      amendmentDate: contractAmendments.amendmentDate,
      valueChange: contractAmendments.valueChange,
      revisedContractValue: contractAmendments.revisedContractValue,
      referenceNumber: procurementRequests.referenceNumber,
    })
    .from(contractAmendments)
    .innerJoin(contracts, eq(contractAmendments.contractId, contracts.id))
    .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(contracts.procurementRequestId, procurementRequests.id))
    .where(
      and(
        gte(contractAmendments.amendmentDate, start.toISOString().slice(0, 10)),
        lt(contractAmendments.amendmentDate, end.toISOString().slice(0, 10))
      )
    );

  // Part III — contracts that became 'completed' this month (from the audit trail,
  // since contracts.updatedAt alone can't tell us WHEN a status change happened).
  const completedLogs = await db
    .select({ entityId: auditLogs.entityId, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "contract"),
        eq(auditLogs.action, "contract.status_changed"),
        gte(auditLogs.createdAt, start),
        lt(auditLogs.createdAt, end),
        sql`${auditLogs.details}->>'status' = 'completed'`
      )
    );
  const completedIds = completedLogs.map((l) => l.entityId).filter((id): id is number => id !== null);

  const partIII = completedIds.length
    ? await db
        .select({
          contractNumber: contracts.contractNumber,
          subject: contracts.title,
          providerName: suppliers.name,
          providerCategory: suppliers.providerCategory,
          contractValue: contracts.contractValue,
          referenceNumber: procurementRequests.referenceNumber,
        })
        .from(contracts)
        .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
        .leftJoin(procurementRequests, eq(contracts.procurementRequestId, procurementRequests.id))
        .where(inArray(contracts.id, completedIds))
    : [];

  // Part IV — micro procurements awarded this month
  const microRequests = await db
    .select({
      id: procurementRequests.id,
      referenceNumber: procurementRequests.referenceNumber,
      subject: procurementRequests.subjectOfProcurement,
      dateOfAward: procurementRequests.updatedAt,
      estimatedTotalCost: procurementRequests.estimatedTotalCost,
    })
    .from(procurementRequests)
    .where(
      and(
        eq(procurementRequests.status, "approved"),
        eq(procurementRequests.procurementSize, "micro"),
        gte(procurementRequests.updatedAt, start),
        lt(procurementRequests.updatedAt, end)
      )
    );

  const partIV = await Promise.all(
    microRequests.map(async (r) => {
      const [firstItem] = await db
        .select({ description: procurementItems.description })
        .from(procurementItems)
        .where(eq(procurementItems.procurementRequestId, r.id))
        .limit(1);
      return { ...r, itemDescription: firstItem?.description ?? null };
    })
  );

  res.json({ year, month, partI, partII, partIII, partIV });
});

export default router;
