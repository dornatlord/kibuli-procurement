import { Request, Response, NextFunction } from "express";
import { hasPermission, Permission } from "../lib/permissions.js";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
    name: string;
    department: string | null;
    /** The browser that signed in, to name the device on the profile page. */
    userAgent: string;
    signedInAt: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    // Administrator bypasses every role check
    if (req.session.role === "administrator") {
      next();
      return;
    }
    if (!roles.includes(req.session.role ?? "")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Guard a route by permission rather than by role. Preferred over requireRole —
 * permissions live in one place (lib/permissions.ts) so changing what a role can
 * do never means hunting through route files.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const role = req.session.role ?? "";
    const ok = permissions.some((p) => hasPermission(role, p));
    if (!ok) {
      res.status(403).json({
        error: "You do not have permission to perform this action",
      });
      return;
    }
    next();
  };
}
