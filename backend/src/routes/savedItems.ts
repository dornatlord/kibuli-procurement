import { Router } from "express";
import { db } from "../db/index.js";
import { savedItems } from "../db/schema.js";
import { ilike, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(savedItems)
    .where(ilike(savedItems.description, `%${q}%`))
    .orderBy(desc(savedItems.timesUsed))
    .limit(10);
  res.json(rows);
});

export default router;
