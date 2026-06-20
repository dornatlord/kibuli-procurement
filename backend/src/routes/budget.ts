import { Router } from "express";
import { db } from "../db/index.js";
import { budgetItems } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireRole } from "../middleware/auth.js";

const router = Router();

router.patch("/items/:id", requireRole("accounting_officer", "head_of_dept"), async (req, res) => {
  const { budgetedAmount } = req.body;
  await db
    .update(budgetItems)
    .set({ budgetedAmount: String(budgetedAmount) })
    .where(eq(budgetItems.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
