import { asyncRouter } from "../lib/asyncRouter.js";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { auditLogs, procurementRequests, purchaseOrders, userSessions, users } from "../db/schema.js";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { permissionsFor, ROLE_LABELS, Role } from "../lib/permissions.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { describeDevice } from "../lib/devices.js";

const router = asyncRouter();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error:
          "This account has been deactivated. Contact the administrator.",
      });
      return;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    req.session.department = user.department;
    // Lets the profile page list where this person is signed in.
    req.session.userAgent = String(req.get("user-agent") ?? "").slice(0, 300);
    req.session.signedInAt = new Date().toISOString();

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
      department: user.department,
      mustChangePassword: user.mustChangePassword,
      permissions: permissionsFor(user.role),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Login error:", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Re-read from the database so role changes and deactivations by the
  // administrator take effect immediately, without waiting for re-login.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.session.userId));

  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Account is no longer active" });
    return;
  }

  req.session.role = user.role;
  req.session.name = user.name;
  req.session.department = user.department;

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsFor(user.role),
  });
});

router.post("/change-password", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: hash, mustChangePassword: false })
    .where(eq(users.id, user.id));
  await logAudit(user.id, "user.password_changed", "user", user.id);

  res.json({ ok: true });
});

/** The signed-in person's own account, what they may do, and what they've done. */
router.get("/profile", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const count = sql<number>`count(*)::int`;
  const [[raised], [steps], [lpos], [actions], recent] = await Promise.all([
    db.select({ n: count }).from(procurementRequests).where(eq(procurementRequests.createdBy, userId)),
    db
      .select({ n: count })
      .from(auditLogs)
      .where(and(eq(auditLogs.userId, userId), eq(auditLogs.action, "request.status_changed"))),
    db.select({ n: count }).from(purchaseOrders).where(eq(purchaseOrders.createdBy, userId)),
    db.select({ n: count }).from(auditLogs).where(eq(auditLogs.userId, userId)),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.id))
      .limit(10),
  ]);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    permissions: permissionsFor(user.role),
    activity: {
      requestsRaised: raised.n,
      requestSteps: steps.n,
      lposPrepared: lpos.n,
      actionsRecorded: actions.n,
    },
    recent,
  });
});

// A login belongs to whoever's user id its stored session holds.
const sessionsOf = (userId: number) => sql`(${userSessions.sess}->>'userId')::int = ${userId}`;

/** Where the signed-in person is signed in, this device first. */
router.get("/sessions", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(userSessions)
    .where(and(sessionsOf(req.session.userId!), sql`${userSessions.expire} > now()`));

  const devices = rows.map((row) => {
    const sess = row.sess as { userAgent?: string; signedInAt?: string };
    return {
      current: row.sid === req.sessionID,
      device: describeDevice(sess.userAgent),
      signedInAt: sess.signedInAt ?? null,
    };
  });
  devices.sort((a, b) => Number(b.current) - Number(a.current) || (b.signedInAt ?? "").localeCompare(a.signedInAt ?? ""));
  res.json(devices);
});

/** Sign out everywhere except here: for a lost laptop, or a shared computer left signed in. */
router.post("/sessions/sign-out-others", requireAuth, async (req, res) => {
  if (!req.sessionID) {
    res.status(400).json({ error: "This sign-in can't be told apart from the others." });
    return;
  }
  const removed = await db
    .delete(userSessions)
    .where(and(sessionsOf(req.session.userId!), ne(userSessions.sid, req.sessionID)))
    .returning({ sid: userSessions.sid });
  await logAudit(req.session.userId!, "user.signed_out_other_devices", "user", req.session.userId!, {
    devices: removed.length,
  });
  res.json({ signedOut: removed.length });
});

export default router;
