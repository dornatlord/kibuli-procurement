import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { TERMS_KEY, getTerms, validateTerms } from "../lib/terms.js";
import { OFFICIALS_KEY, cleanCustom, cleanOfficials, keepNames, listOfficials, loadOfficials } from "../lib/officials.js";
import { eq } from "drizzle-orm";

const router = asyncRouter();

router.get("/terms", requireAuth, async (_req, res) => {
  res.json(await getTerms());
});

router.put("/terms", requirePermission("system.settings"), async (req, res) => {
  const checked = validateTerms(req.body?.terms);
  if ("error" in checked) {
    res.status(400).json({ error: checked.error });
    return;
  }
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: TERMS_KEY, value: checked.terms, updatedBy: req.session.userId!, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: checked.terms, updatedBy: req.session.userId!, updatedAt: now },
    });
  await logAudit(req.session.userId!, "settings.terms_updated", "setting", null, { terms: checked.terms });
  res.json(checked.terms);
});

/** Anyone signed in reads these: the forms they print carry the names. */
router.get("/officials", requireAuth, async (_req, res) => {
  const { offices, custom } = await loadOfficials();
  res.json(listOfficials(offices, custom));
});

router.put("/officials", requirePermission("system.settings"), async (req, res) => {
  const offices = cleanOfficials(req.body?.officials);
  // Offices the school added are kept as they are unless the page sends its list.
  const custom = Array.isArray(req.body?.custom) ? cleanCustom(req.body.custom) : (await loadOfficials()).custom;
  const value = { ...offices, _custom: custom };
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: OFFICIALS_KEY, value, updatedBy: req.session.userId!, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: req.session.userId!, updatedAt: now },
    });
  await logAudit(req.session.userId!, "settings.officials_updated", "setting", null, {
    offices: Object.keys(offices),
    added: custom.map((c) => c.label),
  });
  res.json(listOfficials(offices, custom));
});

/**
 * Keeps the names filled in on a printed form (TFORM 5's head of department,
 * the head teacher on an LPO…) under the office they were filled in for, so
 * they are offered next time. Anyone who prints requests or makes LPOs adds
 * names this way; changing or removing them is done on the Officials page.
 */
router.post("/officials/remember", requirePermission("requests.print", "purchase_orders.create"), async (req, res) => {
  const entries = Array.isArray(req.body?.names) ? req.body.names.slice(0, 20) : [];
  const now = new Date();
  // Read and write in one go, so two forms printed at once don't lose a name.
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(appSettings).where(eq(appSettings.key, OFFICIALS_KEY)).for("update");
    const value = row?.value && typeof row.value === "object" ? (row.value as Record<string, unknown>) : {};
    const offices = cleanOfficials(value);
    const { custom, kept } = keepNames(offices, cleanCustom(value._custom), entries);
    if (kept.length) {
      const next = { ...offices, _custom: custom };
      await tx
        .insert(appSettings)
        .values({ key: OFFICIALS_KEY, value: next, updatedBy: req.session.userId!, updatedAt: now })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedBy: req.session.userId!, updatedAt: now } });
    }
    return { offices, custom, kept };
  });
  if (saved.kept.length) {
    await logAudit(req.session.userId!, "settings.officials_names_kept", "setting", null, { kept: saved.kept });
  }
  res.json(listOfficials(saved.offices, saved.custom));
});

export default router;
