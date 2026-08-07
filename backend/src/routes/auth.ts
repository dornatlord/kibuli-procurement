import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { permissionsFor, ROLE_LABELS, Role } from "../lib/permissions.js";

const router = Router();

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

  res.json({ ok: true });
});

export default router;
