import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { assets } from "../db/schema.js";
import { eq, asc, sql, and } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = asyncRouter();

async function nextAssetTag(year: number): Promise<string> {
  const [row] = await db
    .select({
      maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(asset_tag, '/', 3) AS INTEGER)), 0)`,
    })
    .from(assets)
    .where(sql`asset_tag LIKE ${"AST/" + year + "/%"}`);
  const next = (row?.maxSeq ?? 0) + 1;
  return `AST/${year}/${String(next).padStart(4, "0")}`;
}

router.get("/", requirePermission("inventory.view"), async (req, res) => {
  const includeDisposed = req.query.includeDisposed === "true";
  const rows = await db
    .select()
    .from(assets)
    .where(includeDisposed ? undefined : eq(assets.isDisposed, false))
    .orderBy(asc(assets.category), asc(assets.name));
  res.json(rows);
});

router.get("/:id", requirePermission("inventory.view"), async (req, res) => {
  const [asset] = await db.select().from(assets).where(eq(assets.id, Number(req.params.id)));
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(asset);
});

router.post("/", requirePermission("inventory.manage"), async (req, res) => {
  const body = req.body;
  if (!body.name) {
    res.status(400).json({ error: "Asset name is required" });
    return;
  }

  const year = new Date().getFullYear();
  const assetTag = await nextAssetTag(year);
  const quantity = Number(body.quantity) || 1;
  const unitValue = Number(body.unitValue) || 0;

  const [asset] = await db
    .insert(assets)
    .values({
      assetTag,
      name: body.name,
      category: body.category || null,
      description: body.description || null,
      quantity: String(quantity),
      unitOfMeasure: body.unitOfMeasure || null,
      unitValue: unitValue ? String(unitValue) : null,
      totalValue: unitValue ? String(quantity * unitValue) : null,
      location: body.location || null,
      condition: body.condition || "new",
      acquisitionDate: body.acquisitionDate || null,
      acquisitionSource: body.acquisitionSource || null,
      goodsReceivedItemId: body.goodsReceivedItemId || null,
      createdBy: req.session.userId!,
    })
    .returning();

  await logAudit(req.session.userId!, "asset.created", "asset", asset.id, {
    assetTag,
    name: asset.name,
  });

  res.status(201).json(asset);
});

router.patch("/:id", requirePermission("inventory.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const fields = [
    "name",
    "category",
    "description",
    "unitOfMeasure",
    "location",
    "condition",
    "acquisitionDate",
    "acquisitionSource",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) patch[f] = body[f] || null;
  }
  if (body.quantity !== undefined || body.unitValue !== undefined) {
    const [existing] = await db.select().from(assets).where(eq(assets.id, id));
    const quantity = body.quantity !== undefined ? Number(body.quantity) : Number(existing?.quantity ?? 1);
    const unitValue = body.unitValue !== undefined ? Number(body.unitValue) : Number(existing?.unitValue ?? 0);
    patch.quantity = String(quantity);
    patch.unitValue = unitValue ? String(unitValue) : null;
    patch.totalValue = unitValue ? String(quantity * unitValue) : null;
  }

  const [updated] = await db.update(assets).set(patch).where(eq(assets.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  await logAudit(req.session.userId!, "asset.updated", "asset", id);
  res.json(updated);
});

router.patch("/:id/dispose", requirePermission("inventory.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { disposalReason } = req.body;

  const [updated] = await db
    .update(assets)
    .set({
      isDisposed: true,
      condition: "disposed",
      disposalDate: new Date().toISOString().slice(0, 10),
      disposalReason: disposalReason || null,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  await logAudit(req.session.userId!, "asset.disposed", "asset", id, { disposalReason });
  res.json(updated);
});

export default router;
