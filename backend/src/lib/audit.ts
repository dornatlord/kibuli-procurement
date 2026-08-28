import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";

/**
 * Records a compliance-trail entry. Never throws — a logging failure must not
 * block the action it is describing.
 */
export async function logAudit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId,
      details: details ?? null,
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}
