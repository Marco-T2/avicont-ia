-- ============================================================
-- DOWN migration for 20260516031300_annual_close_drop_fiscalperiod_fk
-- (MANUAL — not auto-applied)
-- ============================================================
--
-- Re-adds the column nullable. Backfill is NOT provided — restoring the
-- (period → fiscal_year) correlation would require historical context the
-- DOWN script cannot reconstruct deterministically (the original Phase 1
-- backfill joined on (organizationId, year), which still works if the
-- fiscal_years table is intact — see the manual UPDATE at the bottom).
--
-- USAGE:
--   psql "$DATABASE_URL" -f prisma/migrations/20260516031300_annual_close_drop_fiscalperiod_fk/down.sql
-- ============================================================

BEGIN;

ALTER TABLE "fiscal_periods" ADD COLUMN "fiscalYearId" TEXT;

ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_fiscalYearId_fkey"
    FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "fiscal_periods_fiscalYearId_idx"
  ON "fiscal_periods" ("fiscalYearId");

-- Optional natural-join repopulate (uncomment to restore correlation if
-- fiscal_years rows are still present from the original Phase 1 backfill).
-- UPDATE "fiscal_periods" fp
-- SET "fiscalYearId" = fy."id"
-- FROM "fiscal_years" fy
-- WHERE fy."organizationId" = fp."organizationId"
--   AND fy."year"           = fp."year";

COMMIT;
