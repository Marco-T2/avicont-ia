-- DESTRUCTIVE migration: drop FiscalYear ↔ JournalEntry 1:1 FK columns.
--
-- Change: annual-close-canonical-flow (REQ-A.9, CAN-5.6).
-- Replaces 1:1 `closingEntryId` / `openingEntryId` FKs with reverse-lookup
-- via `JournalEntry.sourceType='annual-close' AND sourceId=FiscalYear.id`.
-- The 5-asientos canonical flow emits up to 4 CC + 1 CA entries per FY, so
-- the 1:1 unique-key shape no longer fits.
--
-- DB is disposable per locked D-7 — no data preservation logic. Down script
-- is informational (see annual-close-canonical-flow design #2696 §Schema).

ALTER TABLE "fiscal_years" DROP CONSTRAINT IF EXISTS "fiscal_years_closingEntryId_fkey";
ALTER TABLE "fiscal_years" DROP CONSTRAINT IF EXISTS "fiscal_years_openingEntryId_fkey";

DROP INDEX IF EXISTS "fiscal_years_closingEntryId_key";
DROP INDEX IF EXISTS "fiscal_years_openingEntryId_key";

ALTER TABLE "fiscal_years" DROP COLUMN IF EXISTS "closingEntryId";
ALTER TABLE "fiscal_years" DROP COLUMN IF EXISTS "openingEntryId";
