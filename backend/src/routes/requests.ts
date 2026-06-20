import { Router } from "express";
import { db } from "../db/index.js";
import {
  procurementRequests,
  procurementItems,
  savedItems,
  requestSignatures,
  contractsCommitteeDecisions,
} from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function getWeekNumber(date: Date, yearType: "calendar" | "financial"): { year: number; week: number } {
  let startOfYear: Date;
  if (yearType === "financial") {
    const y = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
    startOfYear = new Date(y, 6, 1);
  } else {
    startOfYear = new Date(date.getFullYear(), 0, 1);
  }
  const diff = date.getTime() - startOfYear.getTime();
  const week = Math.ceil((diff / 86400000 + 1) / 7);
  const year = yearType === "financial"
    ? (date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1)
    : date.getFullYear();
  return { year, week };
}

async function nextSequence(year: number, yearType: "calendar" | "financial"): Promise<number> {
  const [row] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(sequence_number), 0)` })
    .from(procurementRequests)
    .where(and(eq(procurementRequests.year, year), eq(procurementRequests.yearType, yearType)));
  return (row?.maxSeq ?? 0) + 1;
}

function categoryCode(cat: string): string {
  if (cat === "supplies") return "SUPPLIES";
  if (cat === "works") return "WORKS";
  return "NONCONSULT";
}

router.get("/", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(procurementRequests)
    .orderBy(desc(procurementRequests.createdAt));
  res.json(rows);
});

router.get("/:id", requireAuth, async (req, res) => {
  const [request] = await db
    .select()
    .from(procurementRequests)
    .where(eq(procurementRequests.id, Number(req.params.id)));
  if (!request) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const items = await db
    .select()
    .from(procurementItems)
    .where(eq(procurementItems.procurementRequestId, request.id));
  const signatures = await db
    .select()
    .from(requestSignatures)
    .where(eq(requestSignatures.procurementRequestId, request.id));
  const [decision] = await db
    .select()
    .from(contractsCommitteeDecisions)
    .where(eq(contractsCommitteeDecisions.procurementRequestId, request.id));
  res.json({ ...request, items, signatures, decision: decision || null });
});

router.post("/", requireAuth, async (req, res) => {
  const body = req.body;
  const now = new Date();
  const yearType: "calendar" | "financial" = body.yearType || "calendar";
  const { year, week } = getWeekNumber(now, yearType);
  const seq = await nextSequence(year, yearType);
  const refNum = `KIBULI-SS/${categoryCode(body.category)}/${year}/W${week}/${String(seq).padStart(4, "0")}`;

  const [request] = await db
    .insert(procurementRequests)
    .values({
      referenceNumber: refNum,
      category: body.category,
      yearType,
      year,
      weekNumber: week,
      sequenceNumber: seq,
      budgetCategory: body.budgetCategory,
      procurementSize: body.procurementSize,
      subjectOfProcurement: body.subjectOfProcurement,
      procurementPlanReference: body.procurementPlanReference,
      locationForDelivery: body.locationForDelivery,
      dateRequired: body.dateRequired,
      estimatedTotalCost: body.estimatedTotalCost,
      isMultiyear: body.isMultiyear || false,
      multiyearYearOne: body.multiyearYearOne,
      multiyearYearTwo: body.multiyearYearTwo,
      multiyearYearThree: body.multiyearYearThree,
      multiyearYearFour: body.multiyearYearFour,
      voteId: body.voteId,
      subProgrammeId: body.subProgrammeId,
      budgetItemId: body.budgetItemId,
      balanceRemainingManual: body.balanceRemainingManual,
      status: "draft",
      createdBy: req.session.userId!,
    })
    .returning();

  // Insert procurement items
  if (body.items?.length) {
    for (const item of body.items) {
      const total =
        item.quantity && item.estimatedUnitCost
          ? String(Number(item.quantity) * Number(item.estimatedUnitCost))
          : null;

      let savedItemId = item.savedItemId || null;

      if (body.procurementSize === "micro") {
        if (savedItemId) {
          // Update existing saved item
          await db
            .update(savedItems)
            .set({
              lastUnitCost: item.estimatedUnitCost,
              timesUsed: sql`times_used + 1`,
              lastUsedAt: now,
            })
            .where(eq(savedItems.id, savedItemId));
        } else {
          // Create new saved item
          const [saved] = await db
            .insert(savedItems)
            .values({
              description: item.description,
              unitOfMeasure: item.unitOfMeasure,
              lastUnitCost: item.estimatedUnitCost,
              lastUsedAt: now,
            })
            .returning();
          savedItemId = saved.id;
        }
      }

      await db.insert(procurementItems).values({
        procurementRequestId: request.id,
        itemNo: item.itemNo,
        savedItemId,
        description: item.description,
        quantity: item.quantity,
        unitOfMeasure: item.unitOfMeasure,
        estimatedUnitCost: item.estimatedUnitCost,
        marketPrice: item.marketPrice,
        totalCost: total,
      });
    }
  }

  res.status(201).json(request);
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body;
  const id = Number(req.params.id);
  const [request] = await db
    .select()
    .from(procurementRequests)
    .where(eq(procurementRequests.id, id));

  if (!request) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const role = req.session.role!;
  const allowedTransitions: Record<string, string[]> = {
    head_of_dept: ["pending_accounting_officer", "rejected"],
    accounting_officer: ["pending_contracts_committee", "rejected"],
    contracts_chair: ["approved", "rejected"],
    contracts_secretary: ["approved", "rejected"],
    user_dept_member: ["pending_hod"],
  };

  if (!allowedTransitions[role]?.includes(status)) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  await db
    .update(procurementRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(procurementRequests.id, id));

  // Auto-sign
  const sigRoleMap: Record<string, "user_dept" | "head_of_dept" | "accounting_officer"> = {
    user_dept_member: "user_dept",
    head_of_dept: "head_of_dept",
    accounting_officer: "accounting_officer",
  };
  if (sigRoleMap[role]) {
    await db.insert(requestSignatures).values({
      procurementRequestId: id,
      role: sigRoleMap[role],
      signedByUserId: req.session.userId!,
      name: req.session.name!,
      title: role.replace(/_/g, " "),
    });
  }

  res.json({ ok: true });
});

router.post("/:id/committee-decision", requireRole("contracts_chair", "contracts_secretary"), async (req, res) => {
  const id = Number(req.params.id);
  await db.insert(contractsCommitteeDecisions).values({
    procurementRequestId: id,
    ...req.body,
  });
  res.status(201).json({ ok: true });
});

export default router;
