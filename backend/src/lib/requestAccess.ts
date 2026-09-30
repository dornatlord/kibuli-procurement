import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { procurementRequests, users } from "../db/schema.js";
import { hasPermission } from "./permissions.js";

/**
 * Which requests may this session see?
 *  - requests.view.all        → everything
 *  - requests.view.department → anything raised by someone in their department
 *  - requests.view.own        → only what they created
 */
export async function visibleRequestFilter(session: {
  userId?: number;
  role?: string;
  department?: string | null;
}) {
  const role = session.role ?? "";

  if (hasPermission(role, "requests.view.all")) return undefined;

  if (hasPermission(role, "requests.view.department") && session.department) {
    const deptUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.department, session.department));
    const ids = deptUsers.map((u) => u.id);
    if (session.userId && !ids.includes(session.userId)) ids.push(session.userId);
    return ids.length
      ? inArray(procurementRequests.createdBy, ids)
      : eq(procurementRequests.createdBy, session.userId ?? -1);
  }

  return eq(procurementRequests.createdBy, session.userId ?? -1);
}
