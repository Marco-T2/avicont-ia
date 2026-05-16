-- ============================================================
-- Migration: annual_close_drop_fiscalperiod_fk
-- ============================================================
--
-- WHY:
--   Reverts the `fiscal_periods.fiscalYearId` FK column added by
--   20260516030000_annual_close. The annual-close DESIGN rev 2 §2 explicitly
--   says there is NO FK on FiscalPeriod for v1 — the FiscalYear ↔ FiscalPeriod
--   link is logical via (organizationId, year) joined against
--   fiscal_years.@@unique([organizationId, year]). The previous migration
--   contradicted the design and broke 16 legacy fixtures + 10+ tsc errors
--   (every prisma.fiscalPeriod.create({...}) call missing the new NOT NULL
--   column).
--
--   This migration removes ONLY the column + FK constraint. The fiscal_years
--   table, its rows (backfilled by the prior migration), the FiscalYearStatus
--   enum, and the unique/audit indexes are preserved — they are the design's
--   first-class aggregate state, useful as-is.
--
-- WHAT IT DOES NOT TOUCH:
--   - fiscal_years table (kept — design first-class aggregate)
--   - FiscalYearStatus enum (kept)
--   - audit_fiscal_years trigger (kept)
--
-- DOWN: see ./down.sql (manual operator script).
-- ============================================================

ALTER TABLE "fiscal_periods" DROP CONSTRAINT IF EXISTS "fiscal_periods_fiscalYearId_fkey";
DROP INDEX IF EXISTS "fiscal_periods_fiscalYearId_idx";
ALTER TABLE "fiscal_periods" DROP COLUMN IF EXISTS "fiscalYearId";
