import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  procurementRequests,
  procurementItems,
  users,
} from "../db/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { thisYear } from "../lib/years.js";

const router = asyncRouter();

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["acknowledged", "cancelled"],
  acknowledged: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** LPO numbers count up from 1 and start again each year, like the school's LPO books. */
async function nextPoNumber(year: number): Promise<string> {
  const [row] = await db
    .select({ last: sql<number>`COALESCE(MAX(CAST(po_number AS INTEGER)), 0)` })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.year, year), sql`po_number ~ '^[0-9]+$'`));
  return String(Number(row?.last ?? 0) + 1);
}

/**
 * Saves an LPO under the year's next number. Two LPOs saved at the same moment
 * can pick the same number; the unique constraint catches that and the later
 * one takes the number after.
 */
async function insertWithNextNumber(values: Omit<typeof purchaseOrders.$inferInsert, "poNumber" | "year">) {
  // Numbered in Kampala's calendar year.
  const year = thisYear();
  for (let attempt = 0; ; attempt++) {
    try {
      const [po] = await db
        .insert(purchaseOrders)
        .values({ ...values, year, poNumber: await nextPoNumber(year) })
        .returning();
      return po;
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } };
      if (attempt < 3 && (e.code ?? e.cause?.code) === "23505") continue;
      throw err;
    }
  }
}

router.get("/", requirePermission("purchase_orders.view"), async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  // ?requestId= narrows the list to the LPOs raised from one request.
  const requestId = Number(req.query.requestId) || null;
  const filters = [
    status ? eq(purchaseOrders.status, status as any) : undefined,
    requestId ? eq(purchaseOrders.procurementRequestId, requestId) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      year: purchaseOrders.year,
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
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(purchaseOrders.createdAt));
  res.json(rows);
});

router.get("/:id", requirePermission("purchase_orders.view"), async (req, res) => {
  const id = Number(req.params.id);
  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      year: purchaseOrders.year,
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
      requestStatus: procurementRequests.status,
      // The request's date required is the delivery date on the LPO.
      requestDateRequired: procurementRequests.dateRequired,
      requestSubject: procurementRequests.subjectOfProcurement,
      requestCreatedBy: procurementRequests.createdBy,
      preparedByName: users.name,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(purchaseOrders.procurementRequestId, procurementRequests.id))
    .leftJoin(users, eq(purchaseOrders.createdBy, users.id))
    .where(eq(purchaseOrders.id, id));

  if (!po) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id));

  // The completion certificate names the department that asked for the work:
  // the department of whoever raised the request.
  const { requestCreatedBy, ...rest } = po;
  let requestDepartment: string | null = null;
  if (requestCreatedBy) {
    const [requester] = await db
      .select({ department: users.department })
      .from(users)
      .where(eq(users.id, requestCreatedBy));
    requestDepartment = requester?.department ?? null;
  }

  res.json({ ...rest, requestDepartment, items });
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

  const totalAmount = items.reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );

  const po = await insertWithNextNumber({
    supplierId,
    procurementRequestId: procurementRequestId || null,
    issueDate: issueDate || null,
    expectedDeliveryDate: expectedDeliveryDate || null,
    deliveryLocation: deliveryLocation || null,
    termsAndConditions: termsAndConditions || null,
    totalAmount: String(totalAmount),
    createdBy: req.session.userId!,
  });

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
    year: po.year,
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

  // An LPO can be prepared as soon as its request exists, but only goes to
  // the supplier once the request is approved.
  if (status === "issued" && po.procurementRequestId) {
    const [request] = await db
      .select({ status: procurementRequests.status })
      .from(procurementRequests)
      .where(eq(procurementRequests.id, po.procurementRequestId));
    if (request && request.status !== "approved") {
      res.status(400).json({ error: "Approve the request before issuing its LPO to the supplier." });
      return;
    }
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
