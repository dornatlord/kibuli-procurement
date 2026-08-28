import { Router } from "express";
import { db } from "../db/index.js";
import {
  goodsReceivedNotes,
  goodsReceivedItems,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  users,
} from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function nextGrnNumber(year: number): Promise<string> {
  const [row] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(grn_number, '/', 3) AS INTEGER)), 0)` })
    .from(goodsReceivedNotes)
    .where(sql`grn_number LIKE ${"GRN/" + year + "/%"}`);
  const next = (row?.maxSeq ?? 0) + 1;
  return `GRN/${year}/${String(next).padStart(4, "0")}`;
}

router.get("/", requirePermission("goods_received.view"), async (_req, res) => {
  const rows = await db
    .select({
      id: goodsReceivedNotes.id,
      grnNumber: goodsReceivedNotes.grnNumber,
      status: goodsReceivedNotes.status,
      receivedDate: goodsReceivedNotes.receivedDate,
      createdAt: goodsReceivedNotes.createdAt,
      purchaseOrderId: goodsReceivedNotes.purchaseOrderId,
      poNumber: purchaseOrders.poNumber,
      supplierName: suppliers.name,
      receivedByName: users.name,
    })
    .from(goodsReceivedNotes)
    .leftJoin(purchaseOrders, eq(goodsReceivedNotes.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(users, eq(goodsReceivedNotes.receivedByUserId, users.id))
    .orderBy(desc(goodsReceivedNotes.createdAt));
  res.json(rows);
});

router.get("/:id", requirePermission("goods_received.view"), async (req, res) => {
  const id = Number(req.params.id);
  const [grn] = await db
    .select({
      id: goodsReceivedNotes.id,
      grnNumber: goodsReceivedNotes.grnNumber,
      status: goodsReceivedNotes.status,
      receivedDate: goodsReceivedNotes.receivedDate,
      notes: goodsReceivedNotes.notes,
      purchaseOrderId: goodsReceivedNotes.purchaseOrderId,
      poNumber: purchaseOrders.poNumber,
      supplierName: suppliers.name,
      receivedByName: users.name,
    })
    .from(goodsReceivedNotes)
    .leftJoin(purchaseOrders, eq(goodsReceivedNotes.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(users, eq(goodsReceivedNotes.receivedByUserId, users.id))
    .where(eq(goodsReceivedNotes.id, id));

  if (!grn) {
    res.status(404).json({ error: "GRN not found" });
    return;
  }

  const items = await db
    .select({
      id: goodsReceivedItems.id,
      purchaseOrderItemId: goodsReceivedItems.purchaseOrderItemId,
      quantityReceived: goodsReceivedItems.quantityReceived,
      quantityAccepted: goodsReceivedItems.quantityAccepted,
      condition: goodsReceivedItems.condition,
      remarks: goodsReceivedItems.remarks,
      description: purchaseOrderItems.description,
      unitOfMeasure: purchaseOrderItems.unitOfMeasure,
      orderedQuantity: purchaseOrderItems.quantity,
    })
    .from(goodsReceivedItems)
    .leftJoin(purchaseOrderItems, eq(goodsReceivedItems.purchaseOrderItemId, purchaseOrderItems.id))
    .where(eq(goodsReceivedItems.grnId, id));

  res.json({ ...grn, items });
});

router.post("/", requirePermission("goods_received.create"), async (req, res) => {
  const { purchaseOrderId, receivedDate, notes, items } = req.body;

  if (!purchaseOrderId || !items?.length) {
    res.status(400).json({ error: "Purchase order and at least one item are required" });
    return;
  }

  const year = new Date().getFullYear();
  const grnNumber = await nextGrnNumber(year);

  const [grn] = await db
    .insert(goodsReceivedNotes)
    .values({
      grnNumber,
      purchaseOrderId,
      receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
      receivedByUserId: req.session.userId!,
      notes: notes || null,
    })
    .returning();

  for (const it of items) {
    await db.insert(goodsReceivedItems).values({
      grnId: grn.id,
      purchaseOrderItemId: it.purchaseOrderItemId,
      quantityReceived: String(Number(it.quantityReceived) || 0),
      quantityAccepted: String(Number(it.quantityAccepted ?? it.quantityReceived) || 0),
      condition: it.condition || "good",
      remarks: it.remarks || null,
    });
  }

  await logAudit(req.session.userId!, "grn.created", "goods_received_note", grn.id, {
    grnNumber: grn.grnNumber,
    purchaseOrderId,
  });

  res.status(201).json(grn);
});

router.patch("/:id/inspect", requirePermission("goods_received.inspect"), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["accepted", "rejected", "partial"].includes(status)) {
    res.status(400).json({ error: "Status must be accepted, rejected, or partial" });
    return;
  }

  const [updated] = await db
    .update(goodsReceivedNotes)
    .set({ status, inspectedByUserId: req.session.userId! })
    .where(eq(goodsReceivedNotes.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "GRN not found" });
    return;
  }

  await logAudit(req.session.userId!, "grn.inspected", "goods_received_note", id, { status });

  // A fully accepted delivery against every item on the order completes the PO.
  if (status === "accepted" && updated.purchaseOrderId) {
    await db
      .update(purchaseOrders)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, updated.purchaseOrderId));
  }

  res.json(updated);
});

export default router;
