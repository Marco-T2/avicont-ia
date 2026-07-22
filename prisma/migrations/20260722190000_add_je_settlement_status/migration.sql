-- Phase A — JournalEntry settlement fields (unified-comprobante-source-of-truth).
--
-- Additive-only, mirrors 20260518150100_add_je_operational_doc_type minus the
-- constraint swap (no constraint/index changes here: paymentStatus/dueDate are
-- rendered in the contact ledger, never filtered — D5/file-changes lock).
--
-- INVARIANT (D5, locked): "SettlementStatus" is a NEW enum. The existing
-- "PaymentStatus" enum (DRAFT|POSTED|LOCKED|VOIDED) is the Payment DOCUMENT
-- lifecycle and is NOT reused for settlement state. SettlementStatus is the
-- persisted subset of ReceivableStatus/PayableStatus: CANCELLED maps to VOIDED
-- at write time; OVERDUE is derived at read (dueDate < now), never persisted.
--
-- Both columns nullable so they absorb existing rows; backfill runs in a later
-- migration (*_backfill_je_settlement_status). Unlinked JEs (manual/AI/
-- payment-only) stay NULL by design.

-- 1. New enum type
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'VOIDED');

-- 2. Add the nullable settlement columns
ALTER TABLE "journal_entries"
  ADD COLUMN "paymentStatus" "SettlementStatus";

ALTER TABLE "journal_entries"
  ADD COLUMN "dueDate" TIMESTAMPTZ(3);
