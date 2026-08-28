import { Router } from "express";
import { db } from "../db/index.js";
import {
  procurementRequests,
  procurementItems,
  savedItems,
  requestSignatures,
  contractsCommitteeDecisions,
  votes,
  subProgrammes,
  budgetItems,
  users,
} from "../db/schema.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { hasPermission, Permission } from "../lib/permissions.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

/**
 * Which requests may this session see?
 *  - requests.view.all        → everything
 *  - requests.view.department → anything raised by someone in their department
 *  - requests.view.own        → only what they created
 */
async function visibleRequestFilter(session: {
  userId?: number;
  role?: string;
  department?: string | null;
}) {
  const role = session.role ?? "";

  if (hasPermission(role, "requests.view.all")) return undefined;

  if (hasPermission(role, "requests.view.department") && session.department) {
    const deptUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.department, session.department));
    const ids = deptUsers.map((u) => u.id);
    if (session.userId && !ids.includes(session.userId)) ids.push(session.userId);
    return ids.length
      ? inArray(procurementRequests.createdBy, ids)
      : eq(procurementRequests.createdBy, session.userId ?? -1);
  }

  return eq(procurementRequests.createdBy, session.userId ?? -1);
}

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

router.get(
  "/",
  requirePermission(
    "requests.view.own",
    "requests.view.department",
    "requests.view.all"
  ),
  async (req, res) => {
    const filter = await visibleRequestFilter(req.session);
    const extra = [];
    if (req.query.procurementSize) {
      extra.push(eq(procurementRequests.procurementSize, String(req.query.procurementSize) as any));
    }
    if (req.query.status) {
      extra.push(eq(procurementRequests.status, String(req.query.status) as any));
    }
    const where = [filter, ...extra].filter(Boolean);
    const base = db.select().from(procurementRequests);
    const rows = await (where.length ? base.where(and(...where)) : base).orderBy(
      desc(procurementRequests.createdAt)
    );
    res.json(rows);
  }
);

router.get(
  "/:id",
  requirePermission(
    "requests.view.own",
    "requests.view.department",
    "requests.view.all"
  ),
  async (req, res) => {
  const filter = await visibleRequestFilter(req.session);
  const idMatch = eq(procurementRequests.id, Number(req.params.id));
  const [request] = await db
    .select()
    .from(procurementRequests)
    .where(filter ? and(idMatch, filter) : idMatch);
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

  // Resolve names for vote, sub-programme, budget item
  const [vote] = request.voteId
    ? await db.select().from(votes).where(eq(votes.id, request.voteId))
    : [null];
  const [subProg] = request.subProgrammeId
    ? await db.select().from(subProgrammes).where(eq(subProgrammes.id, request.subProgrammeId))
    : [null];
  const [budgetItem] = request.budgetItemId
    ? await db.select().from(budgetItems).where(eq(budgetItems.id, request.budgetItemId))
    : [null];

  res.json({
    ...request,
    items,
    signatures,
    decision: decision || null,
    voteCode: vote?.code || null,
    voteName: vote?.name || null,
    subProgrammeName: subProg ? `${subProg.romanNumeral ? subProg.romanNumeral + " " : ""}${subProg.name}` : null,
    budgetItemName: budgetItem?.name || null,
  });
  }
);

router.post("/", requirePermission("requests.create"), async (req, res) => {
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

  await logAudit(req.session.userId!, "request.created", "procurement_request", request.id, {
    referenceNumber: request.referenceNumber,
  });

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

  // Each target status requires a specific permission. The administrator holds
  // all of them, so it can move a request through any stage.
  const statusPermission: Record<string, Permission> = {
    pending_hod: "requests.submit",
    pending_accounting_officer: "requests.approve.hod",
    pending_contracts_committee: "requests.approve.accounting_officer",
    approved: "requests.approve.committee",
  };

  if (status === "rejected") {
    const canReject =
      hasPermission(role, "requests.approve.hod") ||
      hasPermission(role, "requests.approve.accounting_officer") ||
      hasPermission(role, "requests.approve.committee");
    if (!canReject) {
      res.status(403).json({ error: "You do not have permission to reject requests" });
      return;
    }
  } else {
    const needed = statusPermission[status];
    if (!needed || !hasPermission(role, needed)) {
      res.status(403).json({
        error: "You do not have permission to move this request to that stage",
      });
      return;
    }
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

  await logAudit(req.session.userId!, "request.status_changed", "procurement_request", id, {
    from: request.status,
    to: status,
  });

  res.json({ ok: true });
});

/**
 * Records the Contracts Committee packet (PPDA FORM 5 Part II). The PDU
 * prepares the submission fields (method, shortlist, evaluation committee);
 * the committee chair/secretary fill in the decision. Both sides write to
 * the same record here — the request's actual status transition, which is
 * what determines whether the procurement is approved, still requires
 * requests.approve.committee via PATCH /:id/status above.
 */
router.post(
  "/:id/committee-decision",
  requirePermission("requests.prepare.committee", "requests.approve.committee"),
  async (req, res) => {
    const id = Number(req.params.id);
    const [decision] = await db
      .insert(contractsCommitteeDecisions)
      .values({
        procurementRequestId: id,
        ...req.body,
        chairpersonUserId:
          req.body.decision && req.session.role === "contracts_chair" ? req.session.userId : null,
        chairpersonSignedAt:
          req.body.decision && req.session.role === "contracts_chair" ? new Date() : null,
        secretaryUserId:
          req.body.decision && req.session.role === "contracts_secretary" ? req.session.userId : null,
        secretarySignedAt:
          req.body.decision && req.session.role === "contracts_secretary" ? new Date() : null,
      })
      .returning();

    await logAudit(
      req.session.userId!,
      "committee_decision.recorded",
      "procurement_request",
      id,
      { decision: req.body.decision ?? null }
    );

    res.status(201).json(decision);
  }
);

export default router;
