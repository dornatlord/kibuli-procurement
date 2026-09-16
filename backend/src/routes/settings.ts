import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { TERMS_KEY, getTerms, validateTerms } from "../lib/terms.js";

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

export default router;
