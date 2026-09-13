import type { Request } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import {
  budgetItems,
  itemBasketItems,
  itemBaskets,
  reservePriceItems,
  subProgrammes,
  users,
  votes,
} from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { hasPermission } from "../lib/permissions.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

// Anyone who raises requests can load and save baskets. Changing or removing
// someone else's basket needs price-list rights (procurement unit, administrator).
const canUse = requirePermission("requests.create", "reserve_prices.manage");

function canEdit(req: Request, createdBy: number | null) {
  return (
    createdBy === req.session.userId ||
    hasPermission(req.session.role ?? "", "reserve_prices.manage")
  );
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
const toText = (v: unknown) => (blank(v) ? null : String(v).trim());
const toAmount = (v: unknown) => {
  if (blank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
};
const toId = (v: unknown) => {
  if (blank(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** A basket is offered for at most one budget line. */
function lineFields(b: Record<string, unknown>) {
  const budgetItemId = toId(b.budgetItemId);
  return { budgetItemId, subProgrammeId: budgetItemId ? null : toId(b.subProgrammeId) };
}

/** Map submitted items explicitly: blank numbers become NULL, empty rows are dropped. */
function itemRows(basketId: number, raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : ({} as Record<string, unknown>)))
    .filter((it) => !blank(it.description))
    .map((it, i) => ({
      basketId,
      itemNo: i + 1,
      reservePriceItemId: toId(it.reservePriceItemId),
      description: String(it.description).trim(),
      unitOfMeasure: toText(it.unitOfMeasure),
      defaultQuantity: toAmount(it.defaultQuantity),
      unitCost: toAmount(it.unitCost),
    }));
}

async function findActive(basketId: number) {
  const [basket] = await db
    .select()
    .from(itemBaskets)
    .where(and(eq(itemBaskets.id, basketId), eq(itemBaskets.isActive, true)));
  return basket ?? null;
}

router.get("/", canUse, async (req, res) => {
  const rows = await db
    .select({
      id: itemBaskets.id,
      name: itemBaskets.name,
      description: itemBaskets.description,
      budgetItemId: itemBaskets.budgetItemId,
      subProgrammeId: itemBaskets.subProgrammeId,
      budgetItemName: budgetItems.name,
      subProgrammeName: subProgrammes.name,
      voteCode: votes.code,
      createdBy: itemBaskets.createdBy,
      createdByName: users.name,
      updatedAt: itemBaskets.updatedAt,
    })
    .from(itemBaskets)
    .leftJoin(budgetItems, eq(budgetItems.id, itemBaskets.budgetItemId))
    .leftJoin(subProgrammes, eq(subProgrammes.id, itemBaskets.subProgrammeId))
    .leftJoin(votes, eq(votes.id, sql`coalesce(${budgetItems.voteId}, ${subProgrammes.voteId})`))
    .leftJoin(users, eq(users.id, itemBaskets.createdBy))
    .where(eq(itemBaskets.isActive, true))
    .orderBy(asc(itemBaskets.name));

  // Item counts and today's value: saved quantities × current price.
  const stats = await db
    .select({
      basketId: itemBasketItems.basketId,
      itemCount: sql<number>`count(*)::int`,
      estimatedValue: sql<string>`coalesce(sum(${itemBasketItems.defaultQuantity} * coalesce(${reservePriceItems.currentPrice}, ${itemBasketItems.unitCost})), 0)`,
    })
    .from(itemBasketItems)
    .leftJoin(
      reservePriceItems,
      and(
        eq(reservePriceItems.id, itemBasketItems.reservePriceItemId),
        eq(reservePriceItems.isActive, true)
      )
    )
    .groupBy(itemBasketItems.basketId);
  const statsById = new Map(stats.map((s) => [s.basketId, s]));

  res.json(
    rows.map(({ createdBy, ...b }) => ({
      ...b,
      itemCount: statsById.get(b.id)?.itemCount ?? 0,
      estimatedValue: statsById.get(b.id)?.estimatedValue ?? "0",
      canEdit: canEdit(req, createdBy),
    }))
  );
});

router.get("/:id", canUse, async (req, res) => {
  const basketId = toId(req.params.id);
  const basket = basketId ? await findActive(basketId) : null;
  if (!basket) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }

  const rows = await db
    .select({
      id: itemBasketItems.id,
      itemNo: itemBasketItems.itemNo,
      reservePriceItemId: itemBasketItems.reservePriceItemId,
      description: itemBasketItems.description,
      unitOfMeasure: itemBasketItems.unitOfMeasure,
      defaultQuantity: itemBasketItems.defaultQuantity,
      unitCost: itemBasketItems.unitCost,
      priceName: reservePriceItems.itemName,
      priceUnit: reservePriceItems.unitOfMeasure,
      currentPrice: reservePriceItems.currentPrice,
      maximumPrice: reservePriceItems.maximumPrice,
      priceActive: reservePriceItems.isActive,
    })
    .from(itemBasketItems)
    .leftJoin(reservePriceItems, eq(reservePriceItems.id, itemBasketItems.reservePriceItemId))
    .where(eq(itemBasketItems.basketId, basket.id))
    .orderBy(asc(itemBasketItems.itemNo));

  res.json({
    id: basket.id,
    name: basket.name,
    description: basket.description,
    budgetItemId: basket.budgetItemId,
    subProgrammeId: basket.subProgrammeId,
    canEdit: canEdit(req, basket.createdBy),
    items: rows.map((r) => {
      // A linked item follows the price list while its entry is active.
      const fromPriceList = r.reservePriceItemId !== null && r.priceActive === true;
      return {
        id: r.id,
        itemNo: r.itemNo,
        reservePriceItemId: r.reservePriceItemId,
        fromPriceList,
        description: fromPriceList ? r.priceName ?? r.description : r.description,
        unitOfMeasure: fromPriceList ? r.priceUnit : r.unitOfMeasure,
        unitCost: fromPriceList ? r.currentPrice : r.unitCost,
        maximumPrice: fromPriceList ? r.maximumPrice : null,
        defaultQuantity: r.defaultQuantity,
      };
    }),
  });
});

router.post("/", canUse, async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = toText(b.name);
  if (!name) {
    res.status(400).json({ error: "Give the basket a name" });
    return;
  }

  const basket = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(itemBaskets)
      .values({
        name,
        description: toText(b.description),
        ...lineFields(b),
        createdBy: req.session.userId!,
      })
      .returning();
    const items = itemRows(created.id, b.items);
    if (items.length) await tx.insert(itemBasketItems).values(items);
    return { ...created, itemCount: items.length };
  });

  await logAudit(req.session.userId!, "basket.created", "item_basket", basket.id, {
    name: basket.name,
    items: basket.itemCount,
  });
  res.status(201).json(basket);
});

/** Replace a basket's details and its whole item list. */
router.put("/:id", canUse, async (req, res) => {
  const basketId = toId(req.params.id);
  const existing = basketId ? await findActive(basketId) : null;
  if (!existing) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }
  if (!canEdit(req, existing.createdBy)) {
    res.status(403).json({
      error: "Only the person who made this basket, or the procurement unit, can change it",
    });
    return;
  }

  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = toText(b.name);
  if (!name) {
    res.status(400).json({ error: "Give the basket a name" });
    return;
  }

  const items = itemRows(existing.id, b.items);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(itemBaskets)
      .set({
        name,
        description: toText(b.description),
        ...lineFields(b),
        updatedAt: new Date(),
      })
      .where(eq(itemBaskets.id, existing.id))
      .returning();
    await tx.delete(itemBasketItems).where(eq(itemBasketItems.basketId, existing.id));
    if (items.length) await tx.insert(itemBasketItems).values(items);
    return row;
  });

  await logAudit(req.session.userId!, "basket.updated", "item_basket", existing.id, {
    name,
    items: items.length,
  });
  res.json({ ...updated, itemCount: items.length });
});

router.delete("/:id", canUse, async (req, res) => {
  const basketId = toId(req.params.id);
  const existing = basketId ? await findActive(basketId) : null;
  if (!existing) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }
  if (!canEdit(req, existing.createdBy)) {
    res.status(403).json({
      error: "Only the person who made this basket, or the procurement unit, can remove it",
    });
    return;
  }

  await db
    .update(itemBaskets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(itemBaskets.id, existing.id));

  await logAudit(req.session.userId!, "basket.removed", "item_basket", existing.id, {
    name: existing.name,
  });
  res.json({ ok: true });
});

export default router;
