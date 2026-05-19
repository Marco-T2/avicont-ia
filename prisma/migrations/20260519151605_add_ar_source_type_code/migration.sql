-- glosa-enriquecida-ventas-cobros Phase 0 (T-02/T-04 GREEN)
-- Adds denormalized sourceTypeCode to accounts_receivable per design D7 + REQ-GE-5.
-- Backfill is idempotent: every UPDATE guards `WHERE "sourceTypeCode" IS NULL`.

-- Step 1: AlterTable — nullable column for LOOKUP-B (T-02)
ALTER TABLE "accounts_receivable" ADD COLUMN "sourceTypeCode" TEXT;

-- Step 2: Backfill sale-sourced AR → "VG" (T-04)
UPDATE "accounts_receivable"
SET "sourceTypeCode" = 'VG'
WHERE "sourceType" = 'sale'
  AND "sourceTypeCode" IS NULL;

-- Step 3: Backfill dispatch NOTA_DESPACHO → "ND" (T-04)
-- LEFT-style: orphan AR (sourceId pointing to deleted dispatch) won't match
-- the dispatches row, so they stay NULL (REQ-GE-5 Scenario 5.8).
UPDATE "accounts_receivable" ar
SET "sourceTypeCode" = 'ND'
FROM "dispatches" d
WHERE ar."sourceType" = 'dispatch'
  AND ar."sourceId" = d."id"
  AND d."dispatchType" = 'NOTA_DESPACHO'
  AND ar."sourceTypeCode" IS NULL;

-- Step 4: Backfill dispatch BOLETA_CERRADA → "BC" (T-04)
UPDATE "accounts_receivable" ar
SET "sourceTypeCode" = 'BC'
FROM "dispatches" d
WHERE ar."sourceType" = 'dispatch'
  AND ar."sourceId" = d."id"
  AND d."dispatchType" = 'BOLETA_CERRADA'
  AND ar."sourceTypeCode" IS NULL;

-- Orphan AR rows (deleted Sale/Dispatch) remain NULL — builder fallback "DOC"
-- per REQ-GE-5 Scenario 5.8 + design D5.
