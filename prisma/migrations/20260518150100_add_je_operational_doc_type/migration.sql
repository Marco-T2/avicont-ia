-- M-B — JournalEntry.operationalDocTypeId FK + unique constraint swap
--
-- Per journal-physical-document Marco lock #9 (Option B): DROP the old
-- voucherTypeId-keyed unique constraint and ADD an operationalDocTypeId-keyed
-- one. Pre-prod data descartable; no preservation required.
--
-- R-N2 pre-constraint collision check is a no-op here: the column is freshly
-- added (all rows NULL) and Postgres treats NULL≠NULL in UNIQUE constraints,
-- so no violation is possible at constraint-add time. The check matters AFTER
-- the M-D backfill populates non-null values; that migration runs on its own
-- branch with its own LEFT-JOIN tolerance.

-- 1. Add the FK column (nullable so it absorbs the existing rows)
ALTER TABLE "journal_entries"
  ADD COLUMN "operationalDocTypeId" TEXT;

-- 2. Wire the FK with the same cascade semantics as Payment.operationalDocTypeId
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_operationalDocTypeId_fkey"
    FOREIGN KEY ("operationalDocTypeId")
    REFERENCES "operational_doc_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Drop the old unique constraint and its supporting index
ALTER TABLE "journal_entries"
  DROP CONSTRAINT IF EXISTS "journal_entries_organizationId_voucherTypeId_referenceNumber_key";
DROP INDEX IF EXISTS "journal_entries_organizationId_voucherTypeId_referenceNumber_idx";

-- 4. Add the new operationalDocTypeId-keyed unique constraint
CREATE UNIQUE INDEX "journal_entries_organizationId_operationalDocTypeId_referenc_key"
  ON "journal_entries"("organizationId", "operationalDocTypeId", "referenceNumber");

-- 5. Add the lookup index mirroring the prior shape
CREATE INDEX "journal_entries_organizationId_operationalDocTypeId_referenc_idx"
  ON "journal_entries"("organizationId", "operationalDocTypeId", "referenceNumber");
