-- glosa-enriquecida-ventas-cobros Phase 0 (T-02 GREEN)
-- Adds denormalized sourceTypeCode to accounts_receivable per design D7 + REQ-GE-5.
-- Backfill SQL is appended in T-04 (idempotent UPDATE WHERE sourceTypeCode IS NULL).

-- AlterTable
ALTER TABLE "accounts_receivable" ADD COLUMN "sourceTypeCode" TEXT;
