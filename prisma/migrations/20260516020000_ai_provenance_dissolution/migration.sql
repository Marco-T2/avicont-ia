-- ============================================================
-- AI provenance dissolution — historical backfill (one-shot)
-- ============================================================
--
-- Companion to the domain change in Journal.transitionTo("POSTED"):
-- new AI entries nullify sourceType + aiOriginalText at post time.
-- This migration brings historical AI entries (posted under the old
-- behavior) into the new state, so they become editable retroactively.
--
-- Scope:
--   - sourceType = 'ai' AND status IN ('POSTED','LOCKED','VOIDED')
--       → sourceType = NULL, aiOriginalText = NULL
--   - sourceType = 'ai' AND status = 'DRAFT' → untouched (badge stays
--       "Generado por IA" while user hasn't signed off)
--   - sourceType != 'ai' → untouched (sale/purchase/payment/dispatch
--       remain bound to their upstream document)
--
-- Idempotent: re-running matches zero rows (sourceType already NULL
-- after the first run).

UPDATE "journal_entries"
SET "sourceType" = NULL,
    "aiOriginalText" = NULL
WHERE "sourceType" = 'ai'
  AND "status" IN ('POSTED', 'LOCKED', 'VOIDED');
