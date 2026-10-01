import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { procurementPlanItems, procurementRequests } from "../db/schema.js";
import { eq, asc, desc, and, isNotNull } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { thisYear } from "../lib/years.js";

const router = asyncRouter();

/** "KSS/SUPLS/26/032", trimmed; blank becomes none. */
const referenceFrom = (v: unknown) => {
  const text = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  return text || null;
};

/**
 * The year's plan lines, short: what the New Request form offers for its
 * Procurement Plan Reference. Whoever raises requests may read these, even
 * without the plan itself. `lastUsed` gives, for each budget line ("bi:12",
 * or "sp:5" for a sub-programme with no items), the plan reference its most
 * recent request this year used, so the next one can start from it.
 */
router.get("/lines", requirePermission("procurement_plan.view", "requests.create"), async (req, res) => {
  const year = Number(req.query.year) || thisYear();
  const lines = await db
    .select({
      id: procurementPlanItems.id,
      reference: procurementPlanItems.reference,
      subjectOfProcurement: procurementPlanItems.subjectOfProcurement,
      procurementCategory: procurementPlanItems.procurementCategory,
      procurementMethod: procurementPlanItems.procurementMethod,
      estimatedCost: procurementPlanItems.estimatedCost,
    })
    .from(procurementPlanItems)
    .where(eq(procurementPlanItems.year, year))
    .orderBy(asc(procurementPlanItems.id));

  const inPlan = new Set(lines.map((l) => l.reference).filter(Boolean));
  const used = await db
    .select({
      budgetItemId: procurementRequests.budgetItemId,
      subProgrammeId: procurementRequests.subProgrammeId,
      reference: procurementRequests.procurementPlanReference,
    })
    .from(procurementRequests)
    .where(and(eq(procurementRequests.year, year), isNotNull(procurementRequests.procurementPlanReference)))
    .orderBy(desc(procurementRequests.createdAt));
  const lastUsed: Record<string, string> = {};
  for (const u of used) {
    const key = u.budgetItemId ? `bi:${u.budgetItemId}` : u.subProgrammeId ? `sp:${u.subProgrammeId}` : null;
    const reference = u.reference?.trim();
    if (key && reference && inPlan.has(reference) && !lastUsed[key]) lastUsed[key] = reference;
  }
  res.json({ lines, lastUsed });
});

router.get("/", requirePermission("procurement_plan.view"), async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const rows = await db
    .select()
    .from(procurementPlanItems)
    .where(eq(procurementPlanItems.year, year))
    .orderBy(asc(procurementPlanItems.id));
  res.json(rows);
});

router.get("/:id", requirePermission("procurement_plan.view"), async (req, res) => {
  const [item] = await db
    .select()
    .from(procurementPlanItems)
    .where(eq(procurementPlanItems.id, Number(req.params.id)));
  if (!item) {
    res.status(404).json({ error: "Plan item not found" });
    return;
  }
  res.json(item);
});

router.post("/", requirePermission("procurement_plan.manage"), async (req, res) => {
  const body = req.body;
  if (!body.subjectOfProcurement || !body.year) {
    res.status(400).json({ error: "Subject of procurement and year are required" });
    return;
  }

  const [item] = await db
    .insert(procurementPlanItems)
    .values({
      year: body.year,
      reference: referenceFrom(body.reference),
      subjectOfProcurement: body.subjectOfProcurement,
      currency: body.currency || "UGX",
      estimatedCost: body.estimatedCost ? String(body.estimatedCost) : null,
      sourceOfFunding: body.sourceOfFunding || null,
      procurementMethod: body.procurementMethod || null,
      procurementCategory: body.procurementCategory || null,
      contractType: body.contractType || null,
      isPrequalificationRequired: !!body.isPrequalificationRequired,
      applyReservationScheme: !!body.applyReservationScheme,
      reservationSchemeType: body.reservationSchemeType || null,
      bidInvitationDate: body.bidInvitationDate || null,
      bidClosingDate: body.bidClosingDate || null,
      evaluationReportDate: body.evaluationReportDate || null,
      awardNotificationDate: body.awardNotificationDate || null,
      contractSigningDate: body.contractSigningDate || null,
      completionDate: body.completionDate || null,
      createdBy: req.session.userId!,
    })
    .returning();

  await logAudit(req.session.userId!, "plan_item.created", "procurement_plan_item", item.id, {
    subject: item.subjectOfProcurement,
  });

  res.status(201).json(item);
});

router.patch("/:id", requirePermission("procurement_plan.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  // Text fields pass through; numeric/date/reference fields must become NULL
  // when blank — Postgres rejects '' for those column types.
  const textFields = [
    "subjectOfProcurement",
    "currency",
    "sourceOfFunding",
    "procurementMethod",
    "procurementCategory",
    "contractType",
    "reservationSchemeType",
    "status",
  ] as const;
  const nullableFields = [
    "estimatedCost",
    "bidInvitationDate",
    "bidClosingDate",
    "evaluationReportDate",
    "awardNotificationDate",
    "contractSigningDate",
    "completionDate",
    "linkedRequestId",
  ] as const;
  const boolFields = ["isPrequalificationRequired", "applyReservationScheme"] as const;

  for (const f of textFields) {
    if (body[f] !== undefined) patch[f] = body[f];
  }
  for (const f of nullableFields) {
    if (body[f] !== undefined) patch[f] = body[f] === "" || body[f] === null ? null : body[f];
  }
  for (const f of boolFields) {
    if (body[f] !== undefined) patch[f] = !!body[f];
  }
  if (body.reference !== undefined) patch.reference = referenceFrom(body.reference);

  const [updated] = await db
    .update(procurementPlanItems)
    .set(patch)
    .where(eq(procurementPlanItems.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Plan item not found" });
    return;
  }

  await logAudit(req.session.userId!, "plan_item.updated", "procurement_plan_item", id);
  res.json(updated);
});

export default router;
