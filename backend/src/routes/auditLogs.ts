import { Router } from "express";
import { db } from "../db/index.js";
import { auditLogs, users } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";

const router = Router();

router.get("/", requirePermission("audit.view"), async (req, res) => {
  const entityType = req.query.entityType ? String(req.query.entityType) : null;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(entityType ? eq(auditLogs.entityType, entityType) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  res.json(rows);
});

router.get("/entity-types", requirePermission("audit.view"), async (_req, res) => {
  const rows = await db.selectDistinct({ entityType: auditLogs.entityType }).from(auditLogs);
  res.json(rows.map((r) => r.entityType).sort());
});

export default router;
