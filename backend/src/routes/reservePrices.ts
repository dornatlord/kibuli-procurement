import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { reservePriceItems } from "../db/schema.js";
import { and, asc, eq, ilike } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";

const router = asyncRouter();

router.get("/", requirePermission("reserve_prices.view"), async (req, res) => {
  const category = req.query.category ? String(req.query.category) : null;
  const includeInactive = req.query.includeInactive === "true";

  const conditions = [];
  if (category) conditions.push(eq(reservePriceItems.category, category));
  if (!includeInactive) conditions.push(eq(reservePriceItems.isActive, true));

  const rows = await db
    .select()
    .from(reservePriceItems)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(reservePriceItems.category), asc(reservePriceItems.displayOrder));

  res.json(rows);
});

router.get("/categories", requirePermission("reserve_prices.view"), async (_req, res) => {
  const rows = await db
    .selectDistinct({ category: reservePriceItems.category })
    .from(reservePriceItems)
    .where(eq(reservePriceItems.isActive, true))
    .orderBy(asc(reservePriceItems.category));
  res.json(rows.map((r) => r.category));
});

/** Used by the request form to suggest items and warn when a cost exceeds the ceiling. */
router.get("/search", requirePermission("reserve_prices.view"), async (req, res) => {
  const q = String(req.query.q || "");
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(reservePriceItems)
    .where(and(ilike(reservePriceItems.itemName, `%${q}%`), eq(reservePriceItems.isActive, true)))
    .orderBy(asc(reservePriceItems.itemName))
    .limit(10);
  res.json(rows);
});

router.post("/", requirePermission("reserve_prices.manage"), async (req, res) => {
  const { category, itemName, unitOfMeasure, currentPrice, maximumPrice, year } = req.body;

  if (!category || !itemName) {
    res.status(400).json({ error: "Category and item name are required" });
    return;
  }

  const [item] = await db
    .insert(reservePriceItems)
    .values({
      category,
      itemName,
      unitOfMeasure: unitOfMeasure || null,
      currentPrice: currentPrice || null,
      maximumPrice: maximumPrice || null,
      year: year || 2026,
    })
    .returning();

  res.status(201).json(item);
});

router.patch("/:id", requirePermission("reserve_prices.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { category, itemName, unitOfMeasure, currentPrice, maximumPrice, year } = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (category !== undefined) patch.category = category;
  if (itemName !== undefined) patch.itemName = itemName;
  if (unitOfMeasure !== undefined) patch.unitOfMeasure = unitOfMeasure || null;
  if (currentPrice !== undefined) patch.currentPrice = currentPrice || null;
  if (maximumPrice !== undefined) patch.maximumPrice = maximumPrice || null;
  if (year !== undefined) patch.year = year;

  const [updated] = await db
    .update(reservePriceItems)
    .set(patch)
    .where(eq(reservePriceItems.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(updated);
});

router.patch("/:id/status", requirePermission("reserve_prices.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be true or false" });
    return;
  }

  const [updated] = await db
    .update(reservePriceItems)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(reservePriceItems.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(updated);
});

export default router;
