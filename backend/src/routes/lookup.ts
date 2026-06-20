import { Router } from "express";
import { db } from "../db/index.js";
import { votes, subProgrammes, budgetItems } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/votes", requireAuth, async (_req, res) => {
  const rows = await db.select().from(votes).orderBy(asc(votes.displayOrder));
  res.json(rows);
});

router.get("/votes/:voteId/sub-programmes", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(subProgrammes)
    .where(eq(subProgrammes.voteId, Number(req.params.voteId)))
    .orderBy(asc(subProgrammes.displayOrder));
  res.json(rows);
});

router.get("/sub-programmes/:subId/items", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.subProgrammeId, Number(req.params.subId)))
    .orderBy(asc(budgetItems.displayOrder));
  res.json(rows);
});

router.get("/votes/:voteId/items", requireAuth, async (req, res) => {
  // For votes with no sub-programme
  const rows = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.voteId, Number(req.params.voteId)))
    .orderBy(asc(budgetItems.displayOrder));
  res.json(rows);
});

export default router;
