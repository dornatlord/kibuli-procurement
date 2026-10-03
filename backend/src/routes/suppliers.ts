import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  budgetItems,
  contractsCommitteeDecisions,
  procurementRequests,
  purchaseOrders,
  subProgrammes,
  supplierYears,
  suppliers,
  votes,
} from "../db/schema.js";
import { and, asc, desc, eq, getTableColumns, ilike, ne, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { thisYear, yearFrom } from "../lib/years.js";
import { putOnYearsList, yearsOnList } from "../lib/supplierYears.js";
import { categoriesBySupplier, listYearFor, listYears, prequalifiedList } from "../lib/prequalified.js";
import { hasPermission } from "../lib/permissions.js";
import { visibleRequestFilter } from "../lib/requestAccess.js";
import { lineNumberOf } from "../lib/budgetLines.js";

const router = asyncRouter();

/** Whoever fills in a provider somewhere may read the suppliers to choose from. */
const CHOOSES_PROVIDERS = [
  "suppliers.view",
  "requests.prepare.committee",
  "requests.print",
  "purchase_orders.create",
  "contracts.manage",
] as const;

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
  // Their categories on the pre-qualified list, to show beside each name.
  const categories = await categoriesBySupplier(thisYear(), rows.map((r) => r.id));
  res.json(rows.map((r) => ({ ...r, categories: categories.get(r.id) ?? [] })));
});

/**
 * Every active supplier's name, this year's list first, for the boxes where a
 * supplier is typed (Part II's shortlisted providers, a call-off order's
 * provider) to suggest them, with each one's categories on the pre-qualified
 * list. Whoever fills those in may read it.
 */
router.get("/names", requirePermission(...CHOOSES_PROVIDERS), async (_req, res) => {
  const onThisYearsList = sql<boolean>`exists (
    select 1 from supplier_years sy where sy.supplier_id = ${suppliers.id} and sy.year = ${thisYear()}
  )`;
  const [rows, categories] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name, onThisYearsList })
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(desc(onThisYearsList), asc(suppliers.name)),
    categoriesBySupplier(thisYear()),
  ]);
  res.json(rows.map((r) => ({ ...r, categories: categories.get(r.id) ?? [] })));
});

/**
 * The pre-qualified list in force in a year (this year's unless `year` is
 * given): its categories, each with its suppliers and the budget lines that
 * draw on it. When the year has no list of its own, the latest earlier one is
 * sent, and `year` says which. Phone numbers and addresses go only to those who
 * may see the supplier register.
 */
router.get("/prequalified", requirePermission(...CHOOSES_PROVIDERS), async (req, res) => {
  const asked = yearFrom(req.query.year) ?? thisYear();
  const [year, years] = await Promise.all([listYearFor(asked), listYears()]);
  const categories = year === null ? [] : await prequalifiedList(year);
  const contacts = hasPermission(req.session.role ?? "", "suppliers.view");
  res.json({
    year,
    years,
    categories: contacts
      ? categories
      : categories.map((c) => ({ ...c, members: c.members.map((m) => ({ ...m, phone: null, address: null })) })),
  });
});

/**
 * Who the provider is on a request, for the places that ask for one again: the
 * call-off order, a new LPO and a contract. It's the supplier on the request's
 * latest LPO once there is one, and before that the first provider shortlisted
 * in Part II. Also sends the request's budget line, whose pre-qualified
 * suppliers those places offer first.
 */
router.get("/for-request/:requestId", requirePermission(...CHOOSES_PROVIDERS), async (req, res) => {
  const filter = await visibleRequestFilter(req.session);
  const idMatch = eq(procurementRequests.id, Number(req.params.requestId));
  const [request] = await db
    .select({
      id: procurementRequests.id,
      referenceNumber: procurementRequests.referenceNumber,
      subjectOfProcurement: procurementRequests.subjectOfProcurement,
      year: procurementRequests.year,
      procurementSize: procurementRequests.procurementSize,
      voteId: procurementRequests.voteId,
      subProgrammeId: procurementRequests.subProgrammeId,
      budgetItemId: procurementRequests.budgetItemId,
    })
    .from(procurementRequests)
    .where(filter ? and(idMatch, filter) : idMatch);
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const [[decision], [lpo], vote, line] = await Promise.all([
    db
      .select({ shortlistedProviders: contractsCommitteeDecisions.shortlistedProviders })
      .from(contractsCommitteeDecisions)
      .where(eq(contractsCommitteeDecisions.procurementRequestId, request.id)),
    db
      .select({ supplierId: purchaseOrders.supplierId, name: suppliers.name })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(and(eq(purchaseOrders.procurementRequestId, request.id), ne(purchaseOrders.status, "cancelled")))
      // The latest, as on the request page's call-off order.
      .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id))
      .limit(1),
    request.voteId ? db.select().from(votes).where(eq(votes.id, request.voteId)).then((r) => r[0] ?? null) : null,
    request.budgetItemId
      ? db.select({ name: budgetItems.name }).from(budgetItems).where(eq(budgetItems.id, request.budgetItemId)).then((r) => r[0] ?? null)
      : request.subProgrammeId
      ? db.select({ name: subProgrammes.name }).from(subProgrammes).where(eq(subProgrammes.id, request.subProgrammeId)).then((r) => r[0] ?? null)
      : null,
  ]);

  // Part II keeps the shortlist one name per line, as it prints. Each name is
  // matched to the register where it's spelt the same, so it can be chosen.
  const shortlisted = (decision?.shortlistedProviders ?? "")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  const registered = shortlisted.length
    ? await db
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.isActive, true),
            sql`lower(${suppliers.name}) in (${sql.join(
              shortlisted.map((n) => sql`${n.toLowerCase()}`),
              sql`, `
            )})`
          )
        )
        .orderBy(asc(suppliers.id))
    : [];
  const idOf = (name: string) => registered.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ?? null;

  const lineNumber = vote ? await lineNumberOf(vote.id, request.subProgrammeId, request.budgetItemId) : null;
  const lineKey = request.budgetItemId ? `bi:${request.budgetItemId}` : request.subProgrammeId ? `sp:${request.subProgrammeId}` : null;

  res.json({
    request,
    line: lineKey
      ? { key: lineKey, label: [vote && lineNumber ? `${vote.code}-${lineNumber}` : vote?.code, line?.name].filter(Boolean).join(" ") }
      : null,
    shortlisted: shortlisted.map((name) => ({ name, supplierId: idOf(name) })),
    lpoSupplier: lpo ? { supplierId: lpo.supplierId, name: lpo.name } : null,
    provider: lpo
      ? { name: lpo.name, supplierId: lpo.supplierId, from: "lpo" }
      : shortlisted.length
      ? { name: shortlisted[0], supplierId: idOf(shortlisted[0]), from: "part2" }
      : null,
  });
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
