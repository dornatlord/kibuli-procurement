import { Router } from "express";
import { db } from "../db/index.js";
import { procurementPlanItems } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

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
  const fields = [
    "subjectOfProcurement",
    "currency",
    "estimatedCost",
    "sourceOfFunding",
    "procurementMethod",
    "procurementCategory",
    "contractType",
    "isPrequalificationRequired",
    "applyReservationScheme",
    "reservationSchemeType",
    "bidInvitationDate",
    "bidClosingDate",
    "evaluationReportDate",
    "awardNotificationDate",
    "contractSigningDate",
    "completionDate",
    "linkedRequestId",
    "status",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) patch[f] = body[f];
  }

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
