import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  contracts,
  disposals,
  goodsReceivedNotes,
  invoices,
  procurementRequests,
  purchaseOrders,
  suppliers,
} from "../db/schema.js";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { hasPermission, type Permission } from "../lib/permissions.js";
import { visibleRequestFilter } from "../lib/requestAccess.js";
import { yearsOnList } from "../lib/supplierYears.js";

const router = asyncRouter();

/** Results per kind of record. */
const LIMIT = 15;

/**
 * One search across every year: requests, LPOs, contracts, suppliers,
 * invoices, deliveries, disposals, and the rows of saved FORM 27 returns
 * (Term 1 2026's micro purchases live only there). Each kind is searched only
 * if the person may see it, requests only as far as the Requests list shows
 * them.
 */
router.get("/", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    res.json({ q, results: {} });
    return;
  }
  // The text as typed, with LIKE's own wildcards taken literally.
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const can = (p: Permission) => hasPermission(req.session.role ?? "", p);
  const results: Record<string, unknown[]> = {};

  if (can("requests.view.all") || can("requests.view.department") || can("requests.view.own")) {
    const visible = await visibleRequestFilter(req.session);
    const byItem = sql`exists (select 1 from procurement_items pi
      where pi.procurement_request_id = ${procurementRequests.id} and pi.description ilike ${like})`;
    const match = or(ilike(procurementRequests.referenceNumber, like), ilike(procurementRequests.subjectOfProcurement, like), byItem);
    results.requests = await db
      .select({
        id: procurementRequests.id,
        referenceNumber: procurementRequests.referenceNumber,
        subject: procurementRequests.subjectOfProcurement,
        status: procurementRequests.status,
        year: procurementRequests.year,
        size: procurementRequests.procurementSize,
        total: procurementRequests.estimatedTotalCost,
      })
      .from(procurementRequests)
      .where(visible ? and(match, visible) : match)
      .orderBy(desc(procurementRequests.createdAt))
      .limit(LIMIT);
  }

  if (can("purchase_orders.view")) {
    // "3", "LPO 3" or "3/2025" finds by number; anything else by supplier, request or item.
    const number = q.match(/^(?:lpo\s*(?:no\.?)?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?$/i);
    const byItem = sql`exists (select 1 from purchase_order_items i
      where i.purchase_order_id = ${purchaseOrders.id} and i.description ilike ${like})`;
    const match: SQL | undefined = number
      ? and(
          eq(purchaseOrders.poNumber, String(Number(number[1]))),
          number[2] ? eq(purchaseOrders.year, Number(number[2])) : undefined
        )
      : or(ilike(suppliers.name, like), ilike(procurementRequests.referenceNumber, like), byItem);
    results.lpos = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        year: purchaseOrders.year,
        status: purchaseOrders.status,
        total: purchaseOrders.totalAmount,
        supplierName: suppliers.name,
        referenceNumber: procurementRequests.referenceNumber,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .leftJoin(procurementRequests, eq(procurementRequests.id, purchaseOrders.procurementRequestId))
      .where(match)
      .orderBy(desc(purchaseOrders.year), desc(purchaseOrders.createdAt))
      .limit(LIMIT);
  }

  if (can("contracts.view")) {
    results.contracts = await db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        title: contracts.title,
        status: contracts.status,
        value: contracts.contractValue,
        signedDate: contracts.signedDate,
        createdAt: contracts.createdAt,
        supplierName: suppliers.name,
      })
      .from(contracts)
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(or(ilike(contracts.contractNumber, like), ilike(contracts.title, like), ilike(suppliers.name, like)))
      .orderBy(sql`${contracts.signedDate} desc nulls last`, desc(contracts.id))
      .limit(LIMIT);
  }

  if (can("suppliers.view")) {
    results.suppliers = await db
      .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, isActive: suppliers.isActive, years: yearsOnList })
      .from(suppliers)
      .where(ilike(suppliers.name, like))
      .orderBy(suppliers.name)
      .limit(LIMIT);
  }

  if (can("invoices.view")) {
    results.invoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        amount: invoices.amount,
        status: invoices.status,
        supplierName: suppliers.name,
      })
      .from(invoices)
      .leftJoin(suppliers, eq(suppliers.id, invoices.supplierId))
      .where(or(ilike(invoices.invoiceNumber, like), ilike(suppliers.name, like)))
      .orderBy(desc(invoices.invoiceDate))
      .limit(LIMIT);
  }

  if (can("goods_received.view")) {
    results.deliveries = await db
      .select({
        id: goodsReceivedNotes.id,
        grnNumber: goodsReceivedNotes.grnNumber,
        receivedDate: goodsReceivedNotes.receivedDate,
        status: goodsReceivedNotes.status,
        supplierName: suppliers.name,
      })
      .from(goodsReceivedNotes)
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceivedNotes.purchaseOrderId))
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(or(ilike(goodsReceivedNotes.grnNumber, like), ilike(suppliers.name, like)))
      .orderBy(desc(goodsReceivedNotes.receivedDate))
      .limit(LIMIT);
  }

  if (can("disposals.view")) {
    results.disposals = await db
      .select({
        id: disposals.id,
        referenceNumber: disposals.referenceNumber,
        subject: disposals.subject,
        buyerName: disposals.buyerName,
        awardDate: disposals.awardDate,
        contractPrice: disposals.contractPrice,
      })
      .from(disposals)
      .where(or(ilike(disposals.referenceNumber, like), ilike(disposals.subject, like), ilike(disposals.buyerName, like)))
      .orderBy(sql`${disposals.awardDate} desc nulls last`)
      .limit(LIMIT);
  }

  if (can("reports.view")) {
    // Rows of saved FORM 27 returns whose cells match (the cells, not the column names).
    const rows = await db.execute<{ year: number; term: number; part: string; row: Record<string, string> }>(sql`
      select t.year, t.term, p.key as part, r.value as row
      from termly_reports t
      cross join lateral jsonb_each(t.parts) p
      cross join lateral jsonb_array_elements(p.value) r
      where exists (select 1 from jsonb_each_text(r.value) c where c.value ilike ${like})
      order by t.year desc, t.term desc
      limit ${LIMIT}`);
    results.returns = Array.from(rows);
  }

  res.json({ q, results });
});

export default router;
