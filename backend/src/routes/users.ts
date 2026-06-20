import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", requireRole("accounting_officer", "head_of_dept"), async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      department: users.department,
      createdAt: users.createdAt,
    })
    .from(users);
  res.json(rows);
});

router.post("/", requireRole("accounting_officer"), async (req, res) => {
  const { email, password, name, role, department } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: hash, name, role, department })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  res.status(201).json(user);
});

router.patch("/:id", requireRole("accounting_officer"), async (req, res) => {
  const { name, role, department } = req.body;
  await db
    .update(users)
    .set({ name, role, department })
    .where(eq(users.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
