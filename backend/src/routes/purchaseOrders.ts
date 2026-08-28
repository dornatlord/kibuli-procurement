import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  procurementRequests,
  procurementItems,
} from "../db/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["acknowledged", "cancelled"],
  acknowledged: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

async function nextPoNumber(year: number): Promise<string> {
  const [row] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(po_number, '/', 3) AS INTEGER)), 0)` })
    .from(purchaseOrders)
    .where(sql`po_number LIKE ${"PO/" + year + "/%"}`);
  const next = (row?.maxSeq ?? 0) + 1;
  return `PO/${year}/${String(next).padStart(4, "0")}`;
}

router.get("/", requirePermission("purchase_orders.view"), async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      issueDate: purchaseOrders.issueDate,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      totalAmount: purchaseOrders.totalAmount,
      createdAt: purchaseOrders.createdAt,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      procurementRequestId: purchaseOrders.procurementRequestId,
      referenceNumber: procurementRequests.referenceNumber,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(purchaseOrders.procurementRequestId, procurementRequests.id))
    .where(status ? eq(purchaseOrders.status, status as any) : undefined)
    .orderBy(desc(purchaseOrders.createdAt));
  res.json(rows);
});

router.get("/:id", requirePermission("purchase_orders.view"), async (req, res) => {
  const id = Number(req.params.id);
  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      issueDate: purchaseOrders.issueDate,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      deliveryLocation: purchaseOrders.deliveryLocation,
      totalAmount: purchaseOrders.totalAmount,
      termsAndConditions: purchaseOrders.termsAndConditions,
      createdAt: purchaseOrders.createdAt,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      supplierAddress: suppliers.address,
      supplierPhone: suppliers.phone,
      procurementRequestId: purchaseOrders.procurementRequestId,
      referenceNumber: procurementRequests.referenceNumber,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(purchaseOrders.procurementRequestId, procurementRequests.id))
    .where(eq(purchaseOrders.id, id));

  if (!po) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id));

  res.json({ ...po, items });
});

/** Pulls items from an approved request so a PO can be pre-filled instead of retyped. */
router.get(
  "/from-request/:requestId",
  requirePermission("purchase_orders.create"),
  async (req, res) => {
    const requestId = Number(req.params.requestId);
    const [request] = await db
      .select()
      .from(procurementRequests)
      .where(eq(procurementRequests.id, requestId));
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    const items = await db
      .select()
      .from(procurementItems)
      .where(eq(procurementItems.procurementRequestId, requestId));
    res.json({ request, items });
  }
);

router.post("/", requirePermission("purchase_orders.create"), async (req, res) => {
  const { supplierId, procurementRequestId, issueDate, expectedDeliveryDate, deliveryLocation, termsAndConditions, items } =
    req.body;

  if (!supplierId || !items?.length) {
    res.status(400).json({ error: "Supplier and at least one item are required" });
    return;
  }

  const year = new Date().getFullYear();
  const poNumber = await nextPoNumber(year);
  const totalAmount = items.reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );

  const [po] = await db
    .insert(purchaseOrders)
    .values({
      poNumber,
      supplierId,
      procurementRequestId: procurementRequestId || null,
      issueDate: issueDate || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      deliveryLocation: deliveryLocation || null,
      termsAndConditions: termsAndConditions || null,
      totalAmount: String(totalAmount),
      createdBy: req.session.userId!,
    })
    .returning();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: po.id,
      itemNo: i + 1,
      description: it.description,
      quantity: String(qty),
      unitOfMeasure: it.unitOfMeasure || null,
      unitPrice: String(price),
      totalPrice: String(qty * price),
    });
  }

  await logAudit(req.session.userId!, "purchase_order.created", "purchase_order", po.id, {
    poNumber: po.poNumber,
    supplierId,
  });

  res.status(201).json(po);
});

router.patch("/:id/status", requirePermission("purchase_orders.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  if (!po) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  if (!VALID_TRANSITIONS[po.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot move a ${po.status} order to ${status}` });
    return;
  }

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id))
    .returning();

  await logAudit(req.session.userId!, "purchase_order.status_changed", "purchase_order", id, {
    from: po.status,
    to: status,
  });

  res.json(updated);
});

export default router;
