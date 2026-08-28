import { Router } from "express";
import { db } from "../db/index.js";
import {
  invoices,
  purchaseOrders,
  suppliers,
  goodsReceivedNotes,
} from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

/** Attaches a computed 3-way match verdict: invoice amount vs PO total, and whether goods were accepted. */
async function withMatchInfo(row: {
  id: number;
  amount: string;
  purchaseOrderId: number | null;
}) {
  if (!row.purchaseOrderId) {
    return { ...row, poMatched: null, goodsReceived: null };
  }
  const [po] = await db
    .select({ totalAmount: purchaseOrders.totalAmount })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, row.purchaseOrderId));

  const [grn] = await db
    .select({ status: goodsReceivedNotes.status })
    .from(goodsReceivedNotes)
    .where(
      and(
        eq(goodsReceivedNotes.purchaseOrderId, row.purchaseOrderId),
        eq(goodsReceivedNotes.status, "accepted")
      )
    );

  const poMatched = po?.totalAmount
    ? Math.abs(Number(po.totalAmount) - Number(row.amount)) < 1
    : null;

  return { ...row, poMatched, goodsReceived: !!grn };
}

router.get("/", requirePermission("invoices.view"), async (_req, res) => {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      invoiceDate: invoices.invoiceDate,
      status: invoices.status,
      paidDate: invoices.paidDate,
      purchaseOrderId: invoices.purchaseOrderId,
      poNumber: purchaseOrders.poNumber,
      supplierName: suppliers.name,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
    .orderBy(desc(invoices.createdAt));

  const withMatches = await Promise.all(rows.map(withMatchInfo));
  res.json(withMatches);
});

router.get("/:id", requirePermission("invoices.view"), async (req, res) => {
  const [row] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      invoiceDate: invoices.invoiceDate,
      status: invoices.status,
      paidDate: invoices.paidDate,
      notes: invoices.notes,
      purchaseOrderId: invoices.purchaseOrderId,
      poNumber: purchaseOrders.poNumber,
      poTotalAmount: purchaseOrders.totalAmount,
      supplierName: suppliers.name,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
    .where(eq(invoices.id, Number(req.params.id)));

  if (!row) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(await withMatchInfo(row));
});

router.post("/", requirePermission("invoices.create"), async (req, res) => {
  const { invoiceNumber, supplierId, purchaseOrderId, invoiceDate, amount, notes } = req.body;

  if (!invoiceNumber || !supplierId || !invoiceDate || !amount) {
    res.status(400).json({ error: "Invoice number, supplier, date and amount are required" });
    return;
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      invoiceDate,
      amount: String(amount),
      notes: notes || null,
      createdBy: req.session.userId!,
    })
    .returning();

  await logAudit(req.session.userId!, "invoice.created", "invoice", invoice.id, {
    invoiceNumber,
    amount,
  });

  res.status(201).json(invoice);
});

router.patch("/:id/status", requirePermission("invoices.approve"), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "Status must be approved or rejected" });
    return;
  }

  const [updated] = await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  await logAudit(req.session.userId!, "invoice.status_changed", "invoice", id, { status });
  res.json(updated);
});

router.patch("/:id/pay", requirePermission("invoices.pay"), async (req, res) => {
  const id = Number(req.params.id);
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (invoice.status !== "approved") {
    res.status(400).json({ error: "Only approved invoices can be marked paid" });
    return;
  }

  const [updated] = await db
    .update(invoices)
    .set({ status: "paid", paidDate: new Date().toISOString().slice(0, 10), updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  await logAudit(req.session.userId!, "invoice.paid", "invoice", id, { amount: invoice.amount });
  res.json(updated);
});

export default router;
