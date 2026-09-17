import { asyncRouter } from "../lib/asyncRouter.js";
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
  auditLogs,
} from "../db/schema.js";
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { hasPermission, Permission } from "../lib/permissions.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

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

/** The school's own short forms, as written on its contracts. */
function categoryCode(cat: string): string {
  if (cat === "supplies") return "SUPLS";
  if (cat === "works") return "WORKS";
  return "SERVS";
}

/** "26" for 2026; a financial year spans two, so "26-27". */
function yearCode(year: number, yearType: "calendar" | "financial"): string {
  const yy = String(year).slice(-2);
  return yearType === "financial" ? `${yy}-${String(year + 1).slice(-2)}` : yy;
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

  // When each step happened, for the Date lines on the printed form. A
  // signature records it when the requester, head of department or accounting
  // officer acts in person; otherwise the audit trail of status changes does
  // (e.g. when the administrator moved the request on).
  const history = await db
    .select({ action: auditLogs.action, details: auditLogs.details, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, "procurement_request"), eq(auditLogs.entityId, request.id)))
    .orderBy(asc(auditLogs.id));
  const lastMove = (from: string[], to: string[]) => {
    let at: Date | null = null;
    for (const h of history) {
      const d = (h.details ?? {}) as { from?: string; to?: string };
      if (h.action === "request.status_changed" && from.includes(d.from ?? "") && to.includes(d.to ?? "")) {
        at = h.createdAt;
      }
    }
    return at;
  };
  const signedAt = (role: string) => signatures.find((s) => s.role === role)?.signedAt ?? null;
  const committeeMeeting =
    decision?.committeeMeetingDate ??
    lastMove(["pending_contracts_committee"], ["approved", "rejected"]);
  const stepDates = {
    requested: signedAt("user_dept") ?? lastMove(["draft"], ["pending_hod"]) ?? request.createdAt,
    headOfDepartment:
      signedAt("head_of_dept") ?? lastMove(["pending_hod"], ["pending_accounting_officer"]),
    accountingOfficer:
      signedAt("accounting_officer") ??
      lastMove(["pending_accounting_officer"], ["pending_contracts_committee", "approved"]),
    submittedToCommittee:
      decision?.submissionDate ??
      lastMove(["pending_accounting_officer"], ["pending_contracts_committee"]),
    committeeMeeting,
    chairperson: decision?.chairpersonSignedAt ?? committeeMeeting,
    secretary: decision?.secretarySignedAt ?? committeeMeeting,
  };

  res.json({
    ...request,
    items,
    signatures,
    decision: decision || null,
    stepDates,
    voteCode: vote?.code || null,
    voteName: vote?.name || null,
    subProgrammeName: subProg ? `${subProg.romanNumeral ? subProg.romanNumeral + " " : ""}${subProg.name}` : null,
    budgetItemName: budgetItem?.name || null,
  });
  }
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e.code ?? e.cause?.code) === "23505";
}

router.post("/", requirePermission("requests.create"), async (req, res) => {
  const body = req.body;
  const now = new Date();
  const yearType: "calendar" | "financial" = body.yearType || "calendar";
  const { year, week } = getWeekNumber(now, yearType);

  // A request filled in offline can arrive twice: a send whose reply was lost
  // is sent again. The id the browser gave it finds the copy already saved.
  const clientRef =
    typeof body.clientRef === "string" && UUID.test(body.clientRef) ? body.clientRef.toLowerCase() : null;
  const sendSaved = async () => {
    if (!clientRef) return false;
    const [saved] = await db
      .select()
      .from(procurementRequests)
      .where(eq(procurementRequests.clientRef, clientRef));
    if (!saved) return false;
    if (saved.createdBy === req.session.userId) res.status(200).json(saved);
    else res.status(409).json({ error: "A different request was already saved with this id." });
    return true;
  };
  if (await sendSaved()) return;

  // Part III names one budget line: take its vote, sub-programme and supply
  // code from the most specific choice rather than trusting the form to keep
  // them in step.
  let voteId = body.voteId || null;
  let subProgrammeId = body.subProgrammeId || null;
  let supplyCode: string | null = null;
  if (body.budgetItemId) {
    const [line] = await db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.id, Number(body.budgetItemId)));
    if (line) {
      voteId = line.voteId;
      subProgrammeId = line.subProgrammeId;
      supplyCode = line.supplyCode;
    }
  } else if (subProgrammeId) {
    const [sub] = await db
      .select()
      .from(subProgrammes)
      .where(eq(subProgrammes.id, Number(subProgrammeId)));
    if (sub) {
      voteId = sub.voteId;
      supplyCode = sub.supplyCode;
    }
  }

  // Two requests saved at the same moment can be given the same running number,
  // as when several laptops send work done offline once they reconnect. The
  // reference is unique, so the loser takes the next number.
  let request: typeof procurementRequests.$inferSelect | undefined;
  for (let attempt = 1; !request; attempt++) {
    const seq = await nextSequence(year, yearType);
    // Written the way the school writes them — KSS/SUPLS/26/017/00155: entity,
    // category, year, the code of what is being bought, then the running number.
    const refNum = `KSS/${categoryCode(body.category)}/${yearCode(year, yearType)}/${
      supplyCode ?? "000"
    }/${String(seq).padStart(5, "0")}`;
    try {
      [request] = await db
        .insert(procurementRequests)
        .values({
          referenceNumber: refNum,
          category: body.category,
          yearType,
          year,
          weekNumber: week,
          sequenceNumber: seq,
          supplyCode,
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
          voteId,
          subProgrammeId,
          budgetItemId: body.budgetItemId,
          balanceRemainingManual: body.balanceRemainingManual,
          status: "draft",
          clientRef,
          createdBy: req.session.userId!,
        })
        .returning();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // The same request sent twice at once: the other send saved it.
      if (await sendSaved()) return;
      if (attempt >= 5) throw err;
    }
  }

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

  // The PDU can draft Part II (its submission to the Contracts Committee)
  // while raising a macro request. It is dated automatically once the request
  // actually reaches the committee.
  if (
    body.procurementSize === "macro" &&
    body.partTwo &&
    typeof body.partTwo === "object" &&
    hasPermission(req.session.role ?? "", "requests.prepare.committee")
  ) {
    const submission = submissionFields(body.partTwo);
    if (hasAnyValue(submission)) {
      await db
        .insert(contractsCommitteeDecisions)
        .values({ procurementRequestId: request.id, ...submission });
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

// ── PPDA FORM 5 Part II ────────────────────────────────────────────────────

// Empty strings from inputs must become NULL — Postgres rejects '' for
// numeric and date columns.
const blankValue = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
const textOrNull = (v: unknown) => (blankValue(v) ? null : String(v).trim());
const amountOrNull = (v: unknown) => {
  if (blankValue(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
};
const hasAnyValue = (f: object) => Object.values(f).some((v) => v !== null && v !== undefined);

/** Today's date in Uganda (the server runs on UTC), for dates the form fills in itself. */
function kampalaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());
}

type CommitteeFields = Partial<typeof contractsCommitteeDecisions.$inferInsert>;

/** The PDU's side of Part II — only the fields present in the body. */
function submissionFields(b: Record<string, unknown>) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  const f: CommitteeFields = {};
  if (has("recommendedMethod")) f.recommendedMethod = textOrNull(b.recommendedMethod);
  if (has("methodJustification")) f.methodJustification = textOrNull(b.methodJustification);
  if (has("shortlistedProviders")) f.shortlistedProviders = textOrNull(b.shortlistedProviders);
  if (has("biddingDocumentTeam")) f.biddingDocumentTeam = textOrNull(b.biddingDocumentTeam);
  if (has("evaluationCommittee")) f.evaluationCommittee = textOrNull(b.evaluationCommittee);
  if (has("biddingDocumentCost")) f.biddingDocumentCost = amountOrNull(b.biddingDocumentCost);
  if (has("otherInformation")) f.otherInformation = textOrNull(b.otherInformation);
  return f;
}

/** The committee's decision and conditions for each Part II row, keyed "1"–"6". */
function rowDecisionsFrom(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const rows: Record<string, { decision: string | null; conditions: string | null }> = {};
  for (const key of ["1", "2", "3", "4", "5", "6"]) {
    const r = (raw as Record<string, unknown>)[key];
    if (!r || typeof r !== "object") continue;
    const decision = textOrNull((r as Record<string, unknown>).decision);
    const conditions = textOrNull((r as Record<string, unknown>).conditions);
    if (decision || conditions) rows[key] = { decision, conditions };
  }
  return Object.keys(rows).length ? rows : null;
}

/**
 * Records PPDA FORM 5 Part II. The Procurement and Disposal Unit fills the
 * submission column (requests.prepare.committee); the Contracts Committee
 * fills each row's decision and conditions (requests.approve.committee).
 * Only fields that are sent, and that the caller may change, are updated, so
 * one side's save never wipes the other's. Dates fill themselves: the
 * submission is dated when the PDU first saves it while the request is with
 * the committee, the meeting when the committee first records a decision.
 * Approving the procurement itself still requires requests.approve.committee
 * via PATCH /:id/status above.
 */
router.post(
  "/:id/committee-decision",
  requirePermission("requests.prepare.committee", "requests.approve.committee"),
  async (req, res) => {
    const id = Number(req.params.id);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const role = req.session.role ?? "";
    const canPrepare = hasPermission(role, "requests.prepare.committee");
    const canDecide = hasPermission(role, "requests.approve.committee");

    const [request] = await db
      .select({ id: procurementRequests.id, status: procurementRequests.status })
      .from(procurementRequests)
      .where(eq(procurementRequests.id, id));
    if (!request) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const decisionValue = textOrNull(b.decision);
    if (decisionValue && !["approved", "rejected", "deferred"].includes(decisionValue)) {
      res.status(400).json({ error: `Invalid decision: ${decisionValue}` });
      return;
    }

    // One packet per request — re-saving updates it rather than stacking duplicates.
    const [existing] = await db
      .select()
      .from(contractsCommitteeDecisions)
      .where(eq(contractsCommitteeDecisions.procurementRequestId, id));

    const fields: CommitteeFields = {};
    if (canPrepare) {
      const submission = submissionFields(b);
      Object.assign(fields, submission);
      if (
        !existing?.submissionDate &&
        request.status === "pending_contracts_committee" &&
        hasAnyValue(submission)
      ) {
        fields.submissionDate = kampalaToday();
      }
    }
    if (canDecide) {
      if (has("decision")) {
        fields.decision = decisionValue as "approved" | "rejected" | "deferred" | null;
      }
      if (has("decisionJustification")) fields.decisionJustification = textOrNull(b.decisionJustification);
      if (has("meetingReference")) fields.meetingReference = textOrNull(b.meetingReference);
      if (has("rowDecisions")) fields.rowDecisions = rowDecisionsFrom(b.rowDecisions);
      const decided = !!decisionValue || !!fields.rowDecisions;
      if (decided && !existing?.committeeMeetingDate) fields.committeeMeetingDate = kampalaToday();
      if (decisionValue && role === "contracts_chair") {
        fields.chairpersonUserId = req.session.userId!;
        fields.chairpersonSignedAt = new Date();
      }
      if (decisionValue && role === "contracts_secretary") {
        fields.secretaryUserId = req.session.userId!;
        fields.secretarySignedAt = new Date();
      }
    }

    const [decision] = existing
      ? Object.keys(fields).length
        ? await db
            .update(contractsCommitteeDecisions)
            .set(fields)
            .where(eq(contractsCommitteeDecisions.id, existing.id))
            .returning()
        : [existing]
      : await db
          .insert(contractsCommitteeDecisions)
          .values({ procurementRequestId: id, ...fields })
          .returning();

    await logAudit(
      req.session.userId!,
      "committee_decision.recorded",
      "procurement_request",
      id,
      { decision: decisionValue }
    );

    res.status(201).json(decision);
  }
);

export default router;
