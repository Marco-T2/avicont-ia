-- Phase B — Backfill JournalEntry.paymentStatus + dueDate from the linked
-- receivable/payable (unified-comprobante-source-of-truth, D4).
--
-- Mirrors 20260518150300_backfill_je_operational_doc_type: pure SQL, orphan
-- tolerance, IS NULL never-overwrite guard, header-locked mappings.
--
-- Mapping (locked D3 — MUST mirror modules/shared/domain/value-objects/
-- settlement-status.ts `toSettlementStatus` textually):
--   PENDING   → PENDING
--   PARTIAL   → PARTIAL
--   PAID      → PAID
--   VOIDED    → VOIDED
--   CANCELLED → VOIDED   (legacy pg-compat member — application writes VOIDED)
--   OVERDUE   → PENDING  (read-derived, never persisted — defensive totality)
--
-- Precedence (locked D4): CxC-over-CxP = the CxC UPDATE pass runs FIRST; the
-- CxP pass is guarded by je."paymentStatus" IS NULL so a JE already stamped
-- from its receivable is never overwritten by a payable.
--
-- 1:N handling (locked D4): JE.receivables / JE.payables are one-to-many.
-- DISTINCT ON (journalEntryId) ORDER BY "createdAt" DESC, "id" DESC = the most
-- recently created aux row wins (deterministic last-wins, matching the
-- read-path Map-overwrite behavior in ledger.service). "id" DESC is a total
-- tie-break for equal createdAt timestamps. Pre-flight recon 2026-07-22: zero
-- JEs with >1 same-side aux row and zero dual-linked JEs — branches are
-- defensive, not load-bearing today.
--
-- status + dueDate come from the SAME winning row (one sub-select provides
-- both), matching the read path where the Map yields one row per JE.
--
-- Orphan tolerance: passes select FROM the aux tables WHERE "journalEntryId"
-- IS NOT NULL; aux rows pointing at a vanished JE simply match no target row.
-- Unlinked JEs (manual/AI/payment-only) are never touched and stay NULL.
--
-- Idempotent-safe re-run: both passes guard on je."paymentStatus" IS NULL —
-- a second run (or a run after live-propagation writes, shipped Phases 3-5)
-- updates 0 rows and never clobbers fresher live values.
--
-- Rollback (manual, documentation-only — do NOT run as part of deploy):
--   UPDATE "journal_entries" je SET "paymentStatus" = NULL, "dueDate" = NULL
--   WHERE EXISTS (SELECT 1 FROM "accounts_receivable" ar WHERE ar."journalEntryId" = je."id")
--      OR EXISTS (SELECT 1 FROM "accounts_payable"    ap WHERE ap."journalEntryId" = je."id");
--   (Also resets values later written by live propagation; acceptable — the
--   live funnel re-stamps on the next aux write, and columns are nullable +
--   unread until the Phase-8 read flip.)

-- Pass 1 — CxC (receivables). Runs FIRST per CxC-over-CxP precedence.
UPDATE "journal_entries" AS je
SET "paymentStatus" = sub.settlement_status,
    "dueDate"       = sub.due_date
FROM (
  SELECT DISTINCT ON (ar."journalEntryId")
    ar."journalEntryId" AS je_id,
    CASE ar."status"
      WHEN 'PENDING'   THEN 'PENDING'
      WHEN 'PARTIAL'   THEN 'PARTIAL'
      WHEN 'PAID'      THEN 'PAID'
      WHEN 'VOIDED'    THEN 'VOIDED'
      WHEN 'CANCELLED' THEN 'VOIDED'
      WHEN 'OVERDUE'   THEN 'PENDING'
    END::"SettlementStatus" AS settlement_status,
    ar."dueDate" AS due_date
  FROM "accounts_receivable" ar
  WHERE ar."journalEntryId" IS NOT NULL
  ORDER BY ar."journalEntryId", ar."createdAt" DESC, ar."id" DESC
) AS sub
WHERE je."id" = sub.je_id
  AND je."paymentStatus" IS NULL;

-- Pass 2 — CxP (payables). Guarded IS NULL: never overwrites Pass 1 (CxC
-- precedence for dual-linked JEs) nor any pre-existing live-written value.
UPDATE "journal_entries" AS je
SET "paymentStatus" = sub.settlement_status,
    "dueDate"       = sub.due_date
FROM (
  SELECT DISTINCT ON (ap."journalEntryId")
    ap."journalEntryId" AS je_id,
    CASE ap."status"
      WHEN 'PENDING'   THEN 'PENDING'
      WHEN 'PARTIAL'   THEN 'PARTIAL'
      WHEN 'PAID'      THEN 'PAID'
      WHEN 'VOIDED'    THEN 'VOIDED'
      WHEN 'CANCELLED' THEN 'VOIDED'
      WHEN 'OVERDUE'   THEN 'PENDING'
    END::"SettlementStatus" AS settlement_status,
    ap."dueDate" AS due_date
  FROM "accounts_payable" ap
  WHERE ap."journalEntryId" IS NOT NULL
  ORDER BY ap."journalEntryId", ap."createdAt" DESC, ap."id" DESC
) AS sub
WHERE je."id" = sub.je_id
  AND je."paymentStatus" IS NULL;
