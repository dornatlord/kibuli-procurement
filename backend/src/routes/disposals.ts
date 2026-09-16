import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { disposals } from "../db/schema.js";
import { desc, eq, like, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

type DisposalFields = Pick<
  typeof disposals.$inferInsert,
  "subject" | "method" | "buyerName" | "awardDate" | "reservePrice" | "contractPrice" | "notes"
>;

/** Maps the form explicitly, blank → null; amounts must be non-negative numbers. */
function fieldsFrom(body: Record<string, unknown>): { fields: DisposalFields } | { error: string } {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const subject = text(body.subject);
  if (!subject) return { error: "Enter the subject of the disposal." };

  const awardDate = text(body.awardDate);
  if (awardDate && !/^\d{4}-\d{2}-\d{2}$/.test(awardDate)) return { error: "Date of award must be a date." };

  const amounts: { reservePrice: string | null; contractPrice: string | null } = {
    reservePrice: null,
    contractPrice: null,
  };
  for (const [key, label] of [
    ["reservePrice", "Reserve price"],
    ["contractPrice", "Contract price"],
  ] as const) {
    const raw = body[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const n = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) return { error: `${label} must be an amount.` };
    amounts[key] = String(n);
  }

  return {
    fields: {
      subject,
      method: text(body.method),
      buyerName: text(body.buyerName),
      awardDate,
      reservePrice: amounts.reservePrice,
      contractPrice: amounts.contractPrice,
      notes: text(body.notes),
    },
  };
}

/** KSS/DISP/26/00001 — the school's reference style, numbered within the year. */
async function nextReference(awardDate: string | null) {
  const yy = (awardDate ?? new Date().toISOString()).slice(2, 4);
  const prefix = `KSS/DISP/${yy}/`;
  const rows = await db
    .select({ ref: disposals.referenceNumber })
    .from(disposals)
    .where(like(disposals.referenceNumber, `${prefix}%`));
  const last = rows.reduce((max, r) => Math.max(max, Number(r.ref.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(5, "0")}`;
}

router.get("/", requirePermission("disposals.view"), async (_req, res) => {
  const rows = await db
    .select()
    .from(disposals)
    .orderBy(sql`${disposals.awardDate} desc nulls last`, desc(disposals.id));
  res.json(rows);
});

router.post("/", requirePermission("disposals.manage"), async (req, res) => {
  const parsed = fieldsFrom(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const referenceNumber = await nextReference(parsed.fields.awardDate ?? null);
  const [row] = await db
    .insert(disposals)
    .values({ ...parsed.fields, referenceNumber, createdBy: req.session.userId! })
    .returning();
  await logAudit(req.session.userId!, "disposal.created", "disposal", row.id, { referenceNumber });
  res.status(201).json(row);
});

router.put("/:id", requirePermission("disposals.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = fieldsFrom(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db
    .update(disposals)
    .set({ ...parsed.fields, updatedAt: new Date() })
    .where(eq(disposals.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Disposal not found" });
    return;
  }
  await logAudit(req.session.userId!, "disposal.updated", "disposal", id);
  res.json(row);
});

router.delete("/:id", requirePermission("disposals.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(disposals).where(eq(disposals.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Disposal not found" });
    return;
  }
  await logAudit(req.session.userId!, "disposal.deleted", "disposal", id, {
    referenceNumber: row.referenceNumber,
    subject: row.subject,
  });
  res.json({ ok: true });
});

export default router;
