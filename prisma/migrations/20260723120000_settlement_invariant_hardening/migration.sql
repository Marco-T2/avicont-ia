-- Settlement invariant hardening (settlement-invariant-hardening, D-1).
--
-- Order is deliberate and NOT negotiable (Marco's decision): SANITIZE FIRST,
-- THEN CONSTRAIN. The aux CHECKs below would reject any surviving legacy
-- OVERDUE row at ADD CONSTRAINT time; draining them first makes the migration
-- self-sufficient on any environment (dev recon 2026-07-23: 0 OVERDUE rows,
-- both tables — the sanitize passes are expected 0-row no-ops in dev and are
-- kept as the auditable prod path).
--
-- Honest split (D-1): the DB enforces co-population + stamp-direction only.
-- The delete-direction (stamped JE whose aux row was later deleted) stays
-- script-assured via scripts/verify-je-settlement-backfill.ts — an AFTER
-- DELETE guard on the aux tables is out of scope here.
--
-- Trigger scope is UPDATE-only (AFTER UPDATE OF "paymentStatus"), verified:
-- production stamps EXCLUSIVELY via syncJournalEntrySettlement's
-- journalEntry.updateMany (modules/{receivables,payables}/infrastructure/
-- prisma-*.repository.ts — sole write sites of the column). Guarding INSERT
-- would break createLinkedFixture in both settlement integration test files
-- (fixture INSERTs the JE already stamped before the aux row exists) for zero
-- production benefit.
-- NOT DEFERRABLE, plain AFTER trigger (audit_trigger_fn precedent): the sync
-- writes the aux row first and the JE stamp second in the SAME tx, so the aux
-- row is visible at statement end.
--
-- Re-stamp passes: value-wise no-ops in expectation. toSettlementStatus
-- (modules/shared/domain/value-objects/settlement-status.ts) collapses
-- OVERDUE -> PENDING, and the backfill (20260722210000) used the same CASE —
-- a JE whose winning aux row was OVERDUE is therefore already stamped
-- PENDING. The passes re-derive from the post-sanitize winner (same
-- DISTINCT ON last-wins + CxC-over-CxP precedence as the backfill) purely as
-- a defensive measure against a JE mis-stamped through an unknown path; they
-- never stamp a previously-unstamped JE ("paymentStatus" IS NOT NULL guard).
--
-- DEPLOY GOTCHA (prod run): `prisma migrate deploy` does NOT surface
-- RAISE NOTICE output. To capture the sanitize counts as the audit trace,
-- either apply this file via psql (notices print to the client) or run the
-- recon queries before AND after the deploy:
--   SELECT count(*) FROM "accounts_receivable" WHERE "status" = 'OVERDUE';
--   SELECT count(*) FROM "accounts_payable"    WHERE "status" = 'OVERDUE';
--   SELECT count(*) FROM "journal_entries"
--     WHERE ("paymentStatus" IS NULL) <> ("dueDate" IS NULL);
--
-- Rollback (manual, documentation-only — do NOT run as part of deploy):
--   DROP TRIGGER IF EXISTS je_settlement_stamp_guard ON journal_entries;
--   DROP FUNCTION IF EXISTS je_settlement_stamp_guard_fn();
--   ALTER TABLE "journal_entries"
--     DROP CONSTRAINT IF EXISTS "journal_entries_settlement_copopulation_check";
--   ALTER TABLE "accounts_receivable"
--     DROP CONSTRAINT IF EXISTS "accounts_receivable_status_no_overdue_check";
--   ALTER TABLE "accounts_payable"
--     DROP CONSTRAINT IF EXISTS "accounts_payable_status_no_overdue_check";
--   (The sanitize UPDATEs are data changes and are NOT auto-reversible:
--   OVERDUE -> PENDING loses which rows were OVERDUE. The RAISE NOTICE output
--   of the deploy run is the audit trace of how many rows were drained.)

-- 1. Sanitize FIRST — drain legacy OVERDUE aux rows, then re-stamp exactly
--    the affected JEs. Counts are logged via RAISE NOTICE for the prod trace.
DO $$
DECLARE
  v_ar_sanitized  INTEGER;
  v_ap_sanitized  INTEGER;
  v_je_pass1      INTEGER;
  v_je_pass2      INTEGER;
BEGIN
  -- Capture the linked JE ids BEFORE draining (the OVERDUE predicate is gone
  -- after the UPDATEs).
  CREATE TEMP TABLE _sanitized_je_ids ON COMMIT DROP AS
    SELECT DISTINCT "journalEntryId" AS je_id
    FROM (
      SELECT "journalEntryId" FROM "accounts_receivable" WHERE "status" = 'OVERDUE'
      UNION ALL
      SELECT "journalEntryId" FROM "accounts_payable"    WHERE "status" = 'OVERDUE'
    ) t
    WHERE "journalEntryId" IS NOT NULL;

  UPDATE "accounts_receivable" SET "status" = 'PENDING' WHERE "status" = 'OVERDUE';
  GET DIAGNOSTICS v_ar_sanitized = ROW_COUNT;

  UPDATE "accounts_payable" SET "status" = 'PENDING' WHERE "status" = 'OVERDUE';
  GET DIAGNOSTICS v_ap_sanitized = ROW_COUNT;

  -- Re-stamp pass 1 — CxC winners for the affected JEs (backfill precedence:
  -- last-wins createdAt DESC, id DESC; status-only — sanitize never touched
  -- dueDate, so the dueDate stamp is untouched too).
  UPDATE "journal_entries" AS je
  SET "paymentStatus" = sub.settlement_status
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
      END::"SettlementStatus" AS settlement_status
    FROM "accounts_receivable" ar
    WHERE ar."journalEntryId" IN (SELECT je_id FROM _sanitized_je_ids)
    ORDER BY ar."journalEntryId", ar."createdAt" DESC, ar."id" DESC
  ) AS sub
  WHERE je."id" = sub.je_id
    AND je."paymentStatus" IS NOT NULL;
  GET DIAGNOSTICS v_je_pass1 = ROW_COUNT;

  -- Re-stamp pass 2 — CxP winners, CxC-over-CxP: only JEs with NO receivable.
  UPDATE "journal_entries" AS je
  SET "paymentStatus" = sub.settlement_status
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
      END::"SettlementStatus" AS settlement_status
    FROM "accounts_payable" ap
    WHERE ap."journalEntryId" IN (SELECT je_id FROM _sanitized_je_ids)
    ORDER BY ap."journalEntryId", ap."createdAt" DESC, ap."id" DESC
  ) AS sub
  WHERE je."id" = sub.je_id
    AND je."paymentStatus" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "accounts_receivable" ar WHERE ar."journalEntryId" = je."id"
    );
  GET DIAGNOSTICS v_je_pass2 = ROW_COUNT;

  RAISE NOTICE 'settlement_invariant_hardening sanitize: AR OVERDUE->PENDING=%, AP OVERDUE->PENDING=%, JE re-stamp touched (CxC)=%, (CxP)=%',
    v_ar_sanitized, v_ap_sanitized, v_je_pass1, v_je_pass2;
END $$;

-- 2. Co-population CHECK — a stamped JE always carries a dueDate and vice
--    versa; manual/unlinked JEs keep both NULL (explicitly valid).
--    Naming mirrors fiscal_years_year_range_check (20260516030000).
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_settlement_copopulation_check"
  CHECK (("paymentStatus" IS NULL) = ("dueDate" IS NULL));

-- 3. Stamp-direction guard — an UPDATE stamping paymentStatus non-null
--    requires a linked aux row (UPDATE-only scope, see header).
CREATE OR REPLACE FUNCTION je_settlement_stamp_guard_fn() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts_receivable WHERE "journalEntryId" = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM accounts_payable WHERE "journalEntryId" = NEW.id) THEN
    RAISE EXCEPTION 'journal_entries.paymentStatus stamped without linked aux (je=%)', NEW.id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER je_settlement_stamp_guard
  AFTER UPDATE OF "paymentStatus" ON journal_entries
  FOR EACH ROW WHEN (NEW."paymentStatus" IS NOT NULL)
  EXECUTE FUNCTION je_settlement_stamp_guard_fn();

-- 4. Aux OVERDUE backstop — DB-level sister of the closed write surface
--    (DEC-A: zod write enums, domain ALLOWED tables, persistence-boundary
--    guard). Lands AFTER the (d) enum closure batches by design.
ALTER TABLE "accounts_receivable"
  ADD CONSTRAINT "accounts_receivable_status_no_overdue_check"
  CHECK ("status" <> 'OVERDUE');

ALTER TABLE "accounts_payable"
  ADD CONSTRAINT "accounts_payable_status_no_overdue_check"
  CHECK ("status" <> 'OVERDUE');
