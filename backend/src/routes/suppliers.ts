import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { suppliers } from "../db/schema.js";
import { and, asc, eq, ilike } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

router.get("/", requirePermission("suppliers.view"), async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const rows = await db
    .select()
    .from(suppliers)
    .where(includeInactive ? undefined : eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));
  res.json(rows);
});

/** Used to pick a supplier when creating a PO, contract, or shortlisting a bid. */
router.get("/search", requirePermission("suppliers.view"), async (req, res) => {
  const q = String(req.query.q || "");
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(suppliers)
    .where(and(ilike(suppliers.name, `%${q}%`), eq(suppliers.isActive, true)))
    .orderBy(asc(suppliers.name))
    .limit(10);
  res.json(rows);
});

router.get("/:id", requirePermission("suppliers.view"), async (req, res) => {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, Number(req.params.id)));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(supplier);
});

router.post("/", requirePermission("suppliers.manage"), async (req, res) => {
  const {
    name,
    contactPerson,
    phone,
    email,
    address,
    tinNumber,
    registrationNumber,
    category,
    providerCategory,
    ownerNames,
    targetGroup,
    isPrequalified,
    notes,
  } = req.body;

  if (!name) {
    res.status(400).json({ error: "Supplier name is required" });
    return;
  }

  const [supplier] = await db
    .insert(suppliers)
    .values({
      name,
      contactPerson: contactPerson || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      tinNumber: tinNumber || null,
      registrationNumber: registrationNumber || null,
      category: category || null,
      providerCategory: providerCategory || "national",
      ownerNames: ownerNames || null,
      targetGroup: targetGroup || null,
      isPrequalified: !!isPrequalified,
      notes: notes || null,
      createdBy: req.session.userId!,
    })
    .returning();

  await logAudit(req.session.userId!, "supplier.created", "supplier", supplier.id, {
    name: supplier.name,
  });

  res.status(201).json(supplier);
});

router.patch("/:id", requirePermission("suppliers.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const {
    name,
    contactPerson,
    phone,
    email,
    address,
    tinNumber,
    registrationNumber,
    category,
    providerCategory,
    ownerNames,
    targetGroup,
    isPrequalified,
    notes,
  } = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name;
  if (contactPerson !== undefined) patch.contactPerson = contactPerson || null;
  if (phone !== undefined) patch.phone = phone || null;
  if (email !== undefined) patch.email = email || null;
  if (address !== undefined) patch.address = address || null;
  if (tinNumber !== undefined) patch.tinNumber = tinNumber || null;
  if (registrationNumber !== undefined) patch.registrationNumber = registrationNumber || null;
  if (category !== undefined) patch.category = category || null;
  if (providerCategory !== undefined) patch.providerCategory = providerCategory;
  if (ownerNames !== undefined) patch.ownerNames = ownerNames || null;
  if (targetGroup !== undefined) patch.targetGroup = targetGroup || null;
  if (isPrequalified !== undefined) patch.isPrequalified = !!isPrequalified;
  if (notes !== undefined) patch.notes = notes || null;

  const [updated] = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  await logAudit(req.session.userId!, "supplier.updated", "supplier", id);
  res.json(updated);
});

router.patch("/:id/status", requirePermission("suppliers.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be true or false" });
    return;
  }

  const [updated] = await db
    .update(suppliers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  await logAudit(
    req.session.userId!,
    isActive ? "supplier.reactivated" : "supplier.deactivated",
    "supplier",
    id
  );
  res.json(updated);
});

export default router;
