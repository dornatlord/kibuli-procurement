-- Adds the administrator and viewer roles, plus account status tracking.
--
-- Postgres will not let a value added to an enum be used in the same
-- transaction, so this runs in two parts. Run PART 1, then PART 2.

-- ============================================================
-- PART 1 — run this on its own first
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';


-- ============================================================
-- PART 2 — run after PART 1 has committed
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active            boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS must_change_password boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at        timestamp;

-- Promote the existing accounting_officer seed account to administrator so
-- there is someone who can manage users after this migration.
UPDATE users
SET role = 'administrator'
WHERE email = 'admin@kibuliss.sch.ug';
