import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { supplierYears, suppliers } from "../db/schema.js";
import { and, asc, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { thisYear, yearFrom } from "../lib/years.js";
import { putOnYearsList, yearsOnList } from "../lib/supplierYears.js";

const router = asyncRouter();

// Each supplier carries `years`: the years' lists it's on. The page shows one
// year's list, or every supplier the school has ever had.

router.get("/", requirePermission("suppliers.view"), async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const rows = await db
    .select({ ...getTableColumns(suppliers), years: yearsOnList })
    .from(suppliers)
    .where(includeInactive ? undefined : eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));
  res.json(rows);
});

/**
 * Used to pick a supplier when creating an LPO, contract or invoice. This
 * year's list comes first; anyone else is marked, and joins this year's list
 * when an LPO or contract is made out to them.
 */
router.get("/search", requirePermission("suppliers.view"), async (req, res) => {
  const q = String(req.query.q || "");
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const onThisYearsList = sql<boolean>`exists (
    select 1 from supplier_years sy where sy.supplier_id = ${suppliers.id} and sy.year = ${thisYear()}
  )`;
  const rows = await db
    .select({ ...getTableColumns(suppliers), onThisYearsList })
    .from(suppliers)
    .where(and(ilike(suppliers.name, `%${q}%`), eq(suppliers.isActive, true)))
    .orderBy(desc(onThisYearsList), asc(suppliers.name))
    .limit(10);
  res.json(rows);
});

/**
 * Starts a year's list from another year's: everyone on it, or just the
 * suppliers ticked. (Starting afresh needs nothing: add suppliers one by one.)
 */
router.post("/lists/:year/start", requirePermission("suppliers.manage"), async (req, res) => {
  const year = yearFrom(req.params.year);
  const from = yearFrom(req.body?.from);
  const chosen: unknown = req.body?.supplierIds;
  if (!year || !from || from === year || (chosen !== undefined && !Array.isArray(chosen))) {
    res.status(400).json({ error: "Choose the year to carry suppliers from." });
    return;
  }
  const onFrom = await db
    .select({ id: supplierYears.supplierId })
    .from(supplierYears)
    .where(eq(supplierYears.year, from));
  const fromIds = new Set(onFrom.map((r) => r.id));
  // Only suppliers on the other year's list can be carried from it.
  const ids = Array.isArray(chosen) ? chosen.map(Number).filter((id) => fromIds.has(id)) : [...fromIds];
  const added = await putOnYearsList(ids, year, req.session.userId!);
  await logAudit(req.session.userId!, "suppliers.list_started", "supplier_list", year, {
    year,
    from,
    carried: added.length,
    of: fromIds.size,
  });
  res.json({ added: added.length });
});

/** Puts a supplier on a year's list. */
router.post("/:id/years/:year", requirePermission("suppliers.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const year = yearFrom(req.params.year);
  const [supplier] = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.id, id));
  if (!supplier || !year) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const added = await putOnYearsList([id], year, req.session.userId!);
  if (added.length) await logAudit(req.session.userId!, "supplier.listed", "supplier", id, { name: supplier.name, year });
  res.json({ added: added.length > 0 });
});

/** Takes a supplier off a year's list. The supplier and its records stay. */
router.delete("/:id/years/:year", requirePermission("suppliers.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const year = yearFrom(req.params.year);
  if (!year) {
    res.status(400).json({ error: "Choose a year." });
    return;
  }
  const removed = await db
    .delete(supplierYears)
    .where(and(eq(supplierYears.supplierId, id), eq(supplierYears.year, year)))
    .returning({ id: supplierYears.supplierId });
  if (removed.length) {
    const [supplier] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, id));
    await logAudit(req.session.userId!, "supplier.unlisted", "supplier", id, { name: supplier?.name, year });
  }
  res.json({ removed: removed.length > 0 });
});

router.get("/:id", requirePermission("suppliers.view"), async (req, res) => {
  const [supplier] = await db
    .select({ ...getTableColumns(suppliers), years: yearsOnList })
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

  // A new supplier joins the list of the year it's added under: this year's
  // unless the page is showing another.
  const year = yearFrom(req.body?.year) ?? thisYear();
  await putOnYearsList([supplier.id], year, req.session.userId!);

  await logAudit(req.session.userId!, "supplier.created", "supplier", supplier.id, {
    name: supplier.name,
    year,
  });

  res.status(201).json({ ...supplier, years: [year] });
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
