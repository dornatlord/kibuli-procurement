import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  auditLogs,
  contractAmendments,
  contracts,
  contractsCommitteeDecisions,
  disposals,
  goodsReceivedNotes,
  invoices,
  procurementRequests,
  purchaseOrders,
  suppliers,
  termlyReports,
  users,
} from "../db/schema.js";
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { getTerms, termRange } from "../lib/terms.js";

const router = asyncRouter();

/** FORM 27's five parts. Every cell is text, so the school can correct it by hand. */
const PART_COLUMNS = {
  partI: ["reference", "subject", "method", "provider", "awardDate", "marketPrice", "contractValue"],
  partII: ["reference", "subject", "change", "provider", "date", "value", "revisedValue"],
  partIII: ["reference", "subject", "provider", "completionDate", "amountPaid", "contractValue"],
  partIV: ["reference", "subject", "provider", "invoiceAndDate", "contractValue"],
  partV: ["reference", "subject", "method", "buyer", "awardDate", "reservePrice", "contractPrice"],
} as const;

type PartKey = keyof typeof PART_COLUMNS;
type Row = Record<string, string>;
type Parts = Record<PartKey, Row[]>;

/** A timestamp's calendar date in Kampala, as YYYY-MM-DD. */
const kampalaDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(d);

/** "2026-01-05" → "05/01/2026", day first as the school writes dates. */
const formDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};

/** "82926000.00" → "82926000"; blank stays blank. */
const amount = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

const inRange = (iso: string | null | undefined, start: string, end: string) => !!iso && iso >= start && iso < end;

/** The first row for each request, in the order given. */
function firstByRequest<T extends { requestId: number | null }>(rows: T[]) {
  const map = new Map<number, T>();
  for (const r of rows) if (r.requestId !== null && !map.has(r.requestId)) map.set(r.requestId, r);
  return map;
}

/**
 * Fills FORM 27 for [start, end) from the system's records. Where the system
 * has no figure (no contract signed, nothing paid yet) the cell is left blank
 * for the school to complete, rather than guessed.
 */
async function buildParts(start: string, end: string): Promise<Parts> {
  // Timestamps count by Kampala date: the term runs midnight to midnight.
  const startAt = new Date(`${start}T00:00:00+03:00`);
  const endAt = new Date(`${end}T00:00:00+03:00`);

  // Approved requests feed Part I (macro) and Part IV (micro).
  const approved = await db
    .select({
      id: procurementRequests.id,
      reference: procurementRequests.referenceNumber,
      subject: procurementRequests.subjectOfProcurement,
      size: procurementRequests.procurementSize,
      estimatedTotalCost: procurementRequests.estimatedTotalCost,
      updatedAt: procurementRequests.updatedAt,
      method: contractsCommitteeDecisions.recommendedMethod,
      meetingDate: contractsCommitteeDecisions.committeeMeetingDate,
    })
    .from(procurementRequests)
    .leftJoin(
      contractsCommitteeDecisions,
      eq(contractsCommitteeDecisions.procurementRequestId, procurementRequests.id)
    )
    .where(eq(procurementRequests.status, "approved"));
  const ids = approved.map((r) => r.id);

  const approvedOn = new Map<number, string>();
  let contractRows: { requestId: number | null; value: string | null; signedDate: string | null; provider: string | null }[] = [];
  let orderRows: { id: number; requestId: number | null; total: string | null; provider: string | null }[] = [];
  if (ids.length) {
    const logs = await db
      .select({ entityId: auditLogs.entityId, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "procurement_request"),
          eq(auditLogs.action, "request.status_changed"),
          sql`${auditLogs.details}->>'to' = 'approved'`,
          inArray(auditLogs.entityId, ids)
        )
      )
      .orderBy(asc(auditLogs.id));
    for (const l of logs) if (l.entityId !== null && l.createdAt) approvedOn.set(l.entityId, kampalaDate(l.createdAt));

    contractRows = await db
      .select({
        requestId: contracts.procurementRequestId,
        value: contracts.contractValue,
        signedDate: contracts.signedDate,
        provider: suppliers.name,
      })
      .from(contracts)
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(inArray(contracts.procurementRequestId, ids))
      .orderBy(asc(contracts.id));

    orderRows = await db
      .select({
        id: purchaseOrders.id,
        requestId: purchaseOrders.procurementRequestId,
        total: purchaseOrders.totalAmount,
        provider: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(and(inArray(purchaseOrders.procurementRequestId, ids), ne(purchaseOrders.status, "cancelled")))
      .orderBy(asc(purchaseOrders.id));
  }
  const contractOf = firstByRequest(contractRows);
  const orderOf = firstByRequest(orderRows);

  // Invoices and deliveries against those orders, for Part IV's
  // "invoice and date of delivery/completion".
  const orderIds = orderRows.map((o) => o.id);
  const lastInvoice = new Map<number, { number: string; date: string }>();
  const lastDelivery = new Map<number, string>();
  if (orderIds.length) {
    const invoiceRows = await db
      .select({ orderId: invoices.purchaseOrderId, number: invoices.invoiceNumber, date: invoices.invoiceDate })
      .from(invoices)
      .where(and(inArray(invoices.purchaseOrderId, orderIds), ne(invoices.status, "rejected")))
      .orderBy(asc(invoices.id));
    for (const i of invoiceRows) if (i.orderId !== null) lastInvoice.set(i.orderId, { number: i.number, date: i.date });

    const deliveryRows = await db
      .select({ orderId: goodsReceivedNotes.purchaseOrderId, date: goodsReceivedNotes.receivedDate })
      .from(goodsReceivedNotes)
      .where(inArray(goodsReceivedNotes.purchaseOrderId, orderIds))
      .orderBy(asc(goodsReceivedNotes.id));
    for (const g of deliveryRows) lastDelivery.set(g.orderId, g.date);
  }

  const awarded: [string, Row][] = [];
  const micro: [string, Row][] = [];
  for (const r of approved) {
    const contract = contractOf.get(r.id);
    const order = orderOf.get(r.id);
    const approvalDate = approvedOn.get(r.id) ?? (r.updatedAt ? kampalaDate(r.updatedAt) : null);

    if (r.size === "macro") {
      // Awarded when the contract was signed; failing that, when the
      // committee met or the request was approved.
      const awardDate = contract?.signedDate ?? r.meetingDate ?? approvalDate;
      if (!awardDate || !inRange(awardDate, start, end)) continue;
      awarded.push([
        awardDate,
        {
          reference: r.reference,
          subject: r.subject ?? "",
          method: r.method ?? "",
          provider: contract?.provider ?? order?.provider ?? "",
          awardDate: formDate(awardDate),
          marketPrice: amount(r.estimatedTotalCost),
          contractValue: amount(contract?.value ?? order?.total),
        },
      ]);
    } else {
      if (!approvalDate || !inRange(approvalDate, start, end)) continue;
      const invoice = order ? lastInvoice.get(order.id) : undefined;
      const delivered = order ? lastDelivery.get(order.id) : undefined;
      micro.push([
        approvalDate,
        {
          reference: r.reference,
          subject: r.subject ?? "",
          provider: order?.provider ?? "",
          invoiceAndDate: invoice ? `${invoice.number}, ${formDate(invoice.date)}` : formDate(delivered),
          contractValue: amount(order?.total ?? r.estimatedTotalCost),
        },
      ]);
    }
  }
  const byDate = (a: [string, Row], b: [string, Row]) => a[0].localeCompare(b[0]) || a[1].reference.localeCompare(b[1].reference);

  // Part II — amendments and variations dated within the term.
  const amendments = await db
    .select({
      reference: procurementRequests.referenceNumber,
      contractNumber: contracts.contractNumber,
      subject: contracts.title,
      change: contractAmendments.description,
      provider: suppliers.name,
      date: contractAmendments.amendmentDate,
      value: contractAmendments.valueChange,
      revisedValue: contractAmendments.revisedContractValue,
    })
    .from(contractAmendments)
    .innerJoin(contracts, eq(contracts.id, contractAmendments.contractId))
    .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .leftJoin(procurementRequests, eq(procurementRequests.id, contracts.procurementRequestId))
    .where(and(gte(contractAmendments.amendmentDate, start), lt(contractAmendments.amendmentDate, end)))
    .orderBy(asc(contractAmendments.amendmentDate), asc(contractAmendments.id));

  // Part III — contracts marked completed within the term. The audit trail
  // records when; paid invoices against the contract's order give the total paid.
  const completedLogs = await db
    .select({ contractId: auditLogs.entityId, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "contract"),
        eq(auditLogs.action, "contract.status_changed"),
        sql`${auditLogs.details}->>'status' = 'completed'`,
        gte(auditLogs.createdAt, startAt),
        lt(auditLogs.createdAt, endAt)
      )
    )
    .orderBy(asc(auditLogs.id));
  const completedOn = new Map<number, string>();
  for (const l of completedLogs) if (l.contractId !== null && l.createdAt) completedOn.set(l.contractId, kampalaDate(l.createdAt));
  const completedIds = [...completedOn.keys()];

  const completed = completedIds.length
    ? await db
        .select({
          id: contracts.id,
          reference: procurementRequests.referenceNumber,
          contractNumber: contracts.contractNumber,
          subject: contracts.title,
          provider: suppliers.name,
          value: contracts.contractValue,
          orderId: contracts.purchaseOrderId,
        })
        .from(contracts)
        .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
        .leftJoin(procurementRequests, eq(procurementRequests.id, contracts.procurementRequestId))
        .where(inArray(contracts.id, completedIds))
    : [];
  const paidOrderIds = completed.map((c) => c.orderId).filter((id): id is number => id !== null);
  const paid = paidOrderIds.length
    ? await db
        .select({ orderId: invoices.purchaseOrderId, total: sql<string>`sum(${invoices.amount})` })
        .from(invoices)
        .where(and(inArray(invoices.purchaseOrderId, paidOrderIds), eq(invoices.status, "paid")))
        .groupBy(invoices.purchaseOrderId)
    : [];
  const paidFor = new Map(paid.map((p) => [p.orderId, p.total]));

  // Part V — disposals awarded within the term.
  const disposed = await db
    .select()
    .from(disposals)
    .where(and(gte(disposals.awardDate, start), lt(disposals.awardDate, end)))
    .orderBy(asc(disposals.awardDate), asc(disposals.id));

  return {
    partI: awarded.sort(byDate).map(([, row]) => row),
    partII: amendments.map((a) => ({
      reference: a.reference ?? a.contractNumber,
      subject: a.subject,
      change: a.change,
      provider: a.provider ?? "",
      date: formDate(a.date),
      value: amount(a.value),
      revisedValue: amount(a.revisedValue),
    })),
    partIII: completed
      .sort((a, b) => (completedOn.get(a.id) ?? "").localeCompare(completedOn.get(b.id) ?? ""))
      .map((c) => ({
        reference: c.reference ?? c.contractNumber,
        subject: c.subject,
        provider: c.provider ?? "",
        completionDate: formDate(completedOn.get(c.id)),
        amountPaid: amount(c.orderId !== null ? paidFor.get(c.orderId) : null),
        contractValue: amount(c.value),
      })),
    partIV: micro.sort(byDate).map(([, row]) => row),
    partV: disposed.map((d) => ({
      reference: d.referenceNumber,
      subject: d.subject,
      method: d.method ?? "",
      buyer: d.buyerName ?? "",
      awardDate: formDate(d.awardDate),
      reservePrice: amount(d.reservePrice),
      contractPrice: amount(d.contractPrice),
    })),
  };
}

/** Keeps FORM 27's known columns only, as trimmed text. */
function cleanParts(raw: unknown): Parts | null {
  if (!raw || typeof raw !== "object") return null;
  const parts = {} as Parts;
  for (const key of Object.keys(PART_COLUMNS) as PartKey[]) {
    const rows = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(rows) || rows.length > 1000) return null;
    parts[key] = rows.map((row) => {
      const src = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return Object.fromEntries(
        PART_COLUMNS[key].map((col) => [col, String(src[col] ?? "").trim().slice(0, 500)])
      );
    });
  }
  return parts;
}

function cleanDeclaration(raw: unknown) {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (k: string) => String(src[k] ?? "").trim().slice(0, 200);
  return { name: text("name"), title: text("title"), date: text("date") };
}

router.get("/", requirePermission("reports.view"), async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const termNo = Number(req.query.term) || 1;
  const term = (await getTerms()).find((t) => t.term === termNo);
  if (!term) {
    res.status(400).json({ error: "Choose Term 1, 2 or 3." });
    return;
  }
  const { start, end } = termRange(year, term);

  const [generated, [saved], [latest]] = await Promise.all([
    buildParts(start, end),
    db
      .select({
        parts: termlyReports.parts,
        declaration: termlyReports.declaration,
        updatedAt: termlyReports.updatedAt,
        updatedByName: users.name,
      })
      .from(termlyReports)
      .leftJoin(users, eq(users.id, termlyReports.updatedBy))
      .where(and(eq(termlyReports.year, year), eq(termlyReports.term, termNo))),
    // The last signatory, to prefill a report nobody has saved yet.
    db
      .select({ declaration: termlyReports.declaration })
      .from(termlyReports)
      .orderBy(desc(termlyReports.updatedAt))
      .limit(1),
  ]);

  res.json({
    year,
    term: termNo,
    startMonth: term.startMonth,
    endMonth: term.endMonth,
    generated,
    saved: saved ?? null,
    lastDeclaration: latest?.declaration ?? null,
  });
});

router.put("/", requirePermission("reports.prepare"), async (req, res) => {
  const year = Number(req.body?.year);
  const term = Number(req.body?.term);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || ![1, 2, 3].includes(term)) {
    res.status(400).json({ error: "Choose a year and term." });
    return;
  }
  const parts = cleanParts(req.body?.parts);
  if (!parts) {
    res.status(400).json({ error: "The report's rows could not be read." });
    return;
  }
  const declaration = cleanDeclaration(req.body?.declaration);
  const userId = req.session.userId!;
  const now = new Date();

  const [row] = await db
    .insert(termlyReports)
    .values({ year, term, parts, declaration, createdBy: userId, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({
      target: [termlyReports.year, termlyReports.term],
      set: { parts, declaration, updatedBy: userId, updatedAt: now },
    })
    .returning();
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));

  await logAudit(userId, "termly_report.saved", "termly_report", row.id, { year, term });
  res.json({ updatedAt: row.updatedAt, updatedByName: me?.name ?? null });
});

export default router;
