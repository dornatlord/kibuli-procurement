import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { budgetAmounts, budgetItems, subProgrammes, votes } from "../db/schema.js";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { thisYear, yearFrom } from "../lib/years.js";

const router = asyncRouter();

/** Blank clears an amount; otherwise a number of shillings, commas allowed. */
function amountFrom(value: unknown): number | null | undefined {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** The budget's lines with one year's amounts, and every year that has any. */
router.get("/", requirePermission("budget.edit"), async (req, res) => {
  const year = yearFrom(req.query.year) ?? thisYear();
  const [allVotes, subs, items, amounts, years] = await Promise.all([
    db.select({ id: votes.id, code: votes.code, name: votes.name }).from(votes).orderBy(asc(votes.displayOrder)),
    db
      .select({ id: subProgrammes.id, voteId: subProgrammes.voteId, romanNumeral: subProgrammes.romanNumeral, name: subProgrammes.name })
      .from(subProgrammes)
      .orderBy(asc(subProgrammes.displayOrder), asc(subProgrammes.id)),
    db
      .select({ id: budgetItems.id, voteId: budgetItems.voteId, subProgrammeId: budgetItems.subProgrammeId, name: budgetItems.name })
      .from(budgetItems)
      .orderBy(asc(budgetItems.displayOrder), asc(budgetItems.id)),
    db
      .select({ itemId: budgetAmounts.budgetItemId, amount: budgetAmounts.amount })
      .from(budgetAmounts)
      .where(eq(budgetAmounts.year, year)),
    db.selectDistinct({ year: budgetAmounts.year }).from(budgetAmounts).orderBy(desc(budgetAmounts.year)),
  ]);
  const amountOf = new Map(amounts.map((a) => [a.itemId, a.amount]));
  res.json({
    year,
    years: years.map((y) => y.year),
    votes: allVotes,
    subProgrammes: subs,
    items: items.map((i) => ({ ...i, amount: amountOf.get(i.id) ?? null })),
  });
});

/** Sets, or with a blank amount clears, one line's amount for a year. */
router.put("/amounts/:itemId", requirePermission("budget.edit"), async (req, res) => {
  const itemId = Number(req.params.itemId);
  const year = yearFrom(req.body?.year);
  const amount = amountFrom(req.body?.amount);
  if (!year || amount === undefined) {
    res.status(400).json({ error: "Give a year and an amount in shillings." });
    return;
  }
  const [item] = await db.select({ id: budgetItems.id }).from(budgetItems).where(eq(budgetItems.id, itemId));
  if (!item) {
    res.status(404).json({ error: "Budget line not found" });
    return;
  }
  const userId = req.session.userId!;
  const which = and(eq(budgetAmounts.budgetItemId, itemId), eq(budgetAmounts.year, year));
  const [before] = await db.select({ amount: budgetAmounts.amount }).from(budgetAmounts).where(which);
  if (amount === null) {
    await db.delete(budgetAmounts).where(which);
  } else {
    await db
      .insert(budgetAmounts)
      .values({ budgetItemId: itemId, year, amount: String(amount), updatedBy: userId })
      .onConflictDoUpdate({
        target: [budgetAmounts.budgetItemId, budgetAmounts.year],
        set: { amount: String(amount), updatedBy: userId, updatedAt: new Date() },
      });
  }
  await logAudit(userId, "budget.amount_set", "budget_item", itemId, {
    year,
    from: before?.amount ?? null,
    to: amount === null ? null : String(amount),
  });
  res.json({ itemId, year, amount: amount === null ? null : String(amount) });
});

/**
 * Starts a year's budget from another year's: every line without an amount in
 * `to` takes its amount from `from`. Amounts already set are left alone.
 */
router.post("/copy", requirePermission("budget.edit"), async (req, res) => {
  const from = yearFrom(req.body?.from);
  const to = yearFrom(req.body?.to);
  if (!from || !to || from === to) {
    res.status(400).json({ error: "Choose two different years." });
    return;
  }
  const userId = req.session.userId!;
  const source = await db
    .select({ itemId: budgetAmounts.budgetItemId, amount: budgetAmounts.amount })
    .from(budgetAmounts)
    .where(eq(budgetAmounts.year, from));
  const copied = source.length
    ? await db
        .insert(budgetAmounts)
        .values(source.map((s) => ({ budgetItemId: s.itemId, year: to, amount: s.amount, updatedBy: userId })))
        .onConflictDoNothing()
        .returning({ itemId: budgetAmounts.budgetItemId })
    : [];
  await logAudit(userId, "budget.copied", "budget", null, { from, to, lines: copied.length });
  res.json({ copied: copied.length });
});

/**
 * Sets many lines' amounts for a year at once, from an imported spreadsheet.
 * Each line's amount is replaced; lines not mentioned are left alone.
 */
router.post("/import", requirePermission("budget.edit"), async (req, res) => {
  const year = yearFrom(req.body?.year);
  const lines: unknown = req.body?.lines;
  if (!year || !Array.isArray(lines) || lines.length === 0 || lines.length > 2000) {
    res.status(400).json({ error: "Give a year and the lines to set." });
    return;
  }
  const wanted = new Map<number, number>();
  for (const l of lines) {
    const itemId = Number((l as any)?.itemId);
    const amount = amountFrom((l as any)?.amount);
    if (!Number.isInteger(itemId) || amount === undefined || amount === null) {
      res.status(400).json({ error: "Every line needs a budget line and an amount in shillings." });
      return;
    }
    wanted.set(itemId, amount);
  }
  const known = await db.select({ id: budgetItems.id }).from(budgetItems).where(inArray(budgetItems.id, [...wanted.keys()]));
  if (known.length !== wanted.size) {
    res.status(400).json({ error: "Some budget lines no longer exist. Reload the page and try again." });
    return;
  }
  const userId = req.session.userId!;
  const before = await db
    .select({ itemId: budgetAmounts.budgetItemId, amount: budgetAmounts.amount })
    .from(budgetAmounts)
    .where(and(eq(budgetAmounts.year, year), inArray(budgetAmounts.budgetItemId, [...wanted.keys()])));
  const changed = [...wanted].filter(([id, amount]) => Number(before.find((b) => b.itemId === id)?.amount) !== amount);
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [itemId, amount] of wanted) {
      await tx
        .insert(budgetAmounts)
        .values({ budgetItemId: itemId, year, amount: String(amount), updatedBy: userId })
        .onConflictDoUpdate({
          target: [budgetAmounts.budgetItemId, budgetAmounts.year],
          set: { amount: String(amount), updatedBy: userId, updatedAt: now },
        });
    }
  });
  await logAudit(userId, "budget.imported", "budget", null, {
    year,
    lines: wanted.size,
    changed: changed.length,
    total: String([...wanted.values()].reduce((a, b) => a + b, 0)),
  });
  res.json({ imported: wanted.size, changed: changed.length });
});

/** For a page still running an older copy of the app: sets this year's amount. */
router.patch("/items/:id", requirePermission("budget.edit"), async (req, res) => {
  const itemId = Number(req.params.id);
  const amount = amountFrom(req.body?.budgetedAmount);
  if (amount === undefined) {
    res.status(400).json({ error: "Give an amount in shillings." });
    return;
  }
  const year = thisYear();
  const which = and(eq(budgetAmounts.budgetItemId, itemId), eq(budgetAmounts.year, year));
  if (amount === null) await db.delete(budgetAmounts).where(which);
  else
    await db
      .insert(budgetAmounts)
      .values({ budgetItemId: itemId, year, amount: String(amount), updatedBy: req.session.userId! })
      .onConflictDoUpdate({
        target: [budgetAmounts.budgetItemId, budgetAmounts.year],
        set: { amount: String(amount), updatedBy: req.session.userId!, updatedAt: new Date() },
      });
  await logAudit(req.session.userId!, "budget.amount_set", "budget_item", itemId, { year, to: amount === null ? null : String(amount) });
  res.json({ ok: true });
});

export default router;
