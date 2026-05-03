-- ============================================================================
-- Sarfees — Super-admin bootstrap seed
-- ============================================================================
-- Creates a single super-admin so the admin portal has a working login on
-- first deploy. The hash below is bcrypt(10) of `ChangeMe!2026`. The
-- mustChangePassword flag is true — the portal redirects to a forced
-- change-password screen on first login.
--
-- Rotate this password by hashing a new value with bcrypt(10) and updating
-- the row. Do NOT ship this seed to production — production should bootstrap
-- via a one-shot, env-gated CLI or admin-API call instead.
--
-- Usage:
--   psql "$DATABASE_URL" -f src/admins/seed/0001-seed-super-admin.sql
-- ============================================================================

INSERT INTO admins (
  email, "fullName", "passwordHash", role, "isActive", "mustChangePassword"
) VALUES (
  'admin@sarfees.com',
  'Sarfees Super Admin',
  '$2b$10$kFXpKV4rWfBI5DBTiLYt6elnQGwtBX4HuRDBideU40BGi0ghToop2',
  'super_admin',
  true,
  true
)
ON CONFLICT (email) DO NOTHING;
