import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { eq, and, count } from "drizzle-orm";
import { ROLE_LABELS, ROLE_PERMISSIONS, Role } from "../lib/permissions.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const SAFE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  department: users.department,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

/** The catalogue of roles and what each one can do — powers the admin UI. */
router.get("/roles", requirePermission("users.view"), (_req, res) => {
  res.json(
    (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      permissions: ROLE_PERMISSIONS[role],
    }))
  );
});

router.get("/", requirePermission("users.view"), async (_req, res) => {
  const rows = await db.select(SAFE_COLUMNS).from(users).orderBy(users.name);
  res.json(rows);
});

router.post("/", requirePermission("users.create"), async (req, res) => {
  const { email, password, name, role, department } = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({ error: "Name, email, password and role are required" });
    return;
  }
  if (!ROLE_PERMISSIONS[role as Role]) {
    res.status(400).json({ error: `Unknown role: ${role}` });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hash,
      name,
      role,
      department: department || null,
      mustChangePassword: true,
    })
    .returning(SAFE_COLUMNS);

  await logAudit(req.session.userId!, "user.created", "user", user.id, {
    email: user.email,
    role: user.role,
  });

  res.status(201).json(user);
});

router.patch("/:id", requirePermission("users.edit"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, department } = req.body;

  if (role && !ROLE_PERMISSIONS[role as Role]) {
    res.status(400).json({ error: `Unknown role: ${role}` });
    return;
  }

  // Never allow the last administrator to be demoted — it would lock everyone out.
  if (role && role !== "administrator") {
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (target?.role === "administrator") {
      const [{ value: adminCount }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "administrator"), eq(users.isActive, true)));
      if (adminCount <= 1) {
        res.status(400).json({
          error: "Cannot change the role of the only administrator",
        });
        return;
      }
    }
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (role !== undefined) patch.role = role;
  if (department !== undefined) patch.department = department || null;

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning(SAFE_COLUMNS);

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logAudit(req.session.userId!, "user.updated", "user", id, { role, department });
  res.json(updated);
});

/** Activate or deactivate an account. Deactivated users cannot log in. */
router.patch(
  "/:id/status",
  requirePermission("users.deactivate"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be true or false" });
      return;
    }
    if (id === req.session.userId) {
      res.status(400).json({ error: "You cannot deactivate your own account" });
      return;
    }

    if (!isActive) {
      const [target] = await db.select().from(users).where(eq(users.id, id));
      if (target?.role === "administrator") {
        const [{ value: adminCount }] = await db
          .select({ value: count() })
          .from(users)
          .where(and(eq(users.role, "administrator"), eq(users.isActive, true)));
        if (adminCount <= 1) {
          res
            .status(400)
            .json({ error: "Cannot deactivate the only administrator" });
          return;
        }
      }
    }

    const [updated] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning(SAFE_COLUMNS);

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await logAudit(
      req.session.userId!,
      isActive ? "user.reactivated" : "user.deactivated",
      "user",
      id
    );
    res.json(updated);
  }
);

/** Administrator sets a new password; the user must change it on next login. */
router.post(
  "/:id/reset-password",
  requirePermission("users.reset_password"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const [updated] = await db
      .update(users)
      .set({ passwordHash: hash, mustChangePassword: true })
      .where(eq(users.id, id))
      .returning(SAFE_COLUMNS);

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true });
  }
);

export default router;
