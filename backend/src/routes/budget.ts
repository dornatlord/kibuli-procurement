import { asyncRouter } from "../lib/asyncRouter.js";
import { db } from "../db/index.js";
import { budgetItems } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";

const router = asyncRouter();

router.patch("/items/:id", requirePermission("budget.edit"), async (req, res) => {
  const { budgetedAmount } = req.body;
  await db
    .update(budgetItems)
    .set({ budgetedAmount: String(budgetedAmount) })
    .where(eq(budgetItems.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
