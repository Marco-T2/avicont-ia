-- ════════════════════════════════════════════════════════════════════════════
-- Migration: cierre-periodo (Phase 1)
--
-- DESTRUCTIVE — dev-only. This migration drops and recreates `fiscal_periods`
-- because we are changing the shape of its unique constraint from
-- (organizationId, year) to (organizationId, year, month). Every FK that
-- references fiscal_periods(id) is dropped by CASCADE and recreated below.
--
-- FK blast list (8 total):
--   journal_entries.periodId
--   account_balances.periodId
--   dispatches.periodId
--   payments.periodId
--   purchases.periodId
--   sales.periodId
--   iva_purchase_books.fiscalPeriodId
--   iva_sales_books.fiscalPeriodId
--
-- Changes to audit infrastructure:
--   - audit_logs.correlationId TEXT NULL (+ index)
--   - audit_trigger_fn() reads app.correlation_id and writes into the new col
--   - audit_fiscal_periods (AFTER UPDATE OR DELETE)
--   - audit_purchases (AFTER UPDATE OR DELETE)
--
-- The User/FiscalPeriodCloser relation is added as an FK to users(id) with
-- ON DELETE SET NULL.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 0) Purge dev data that would orphan after fiscal_periods is dropped.
--    Order matters: delete leaves first, respecting FK dependencies.
--    This is destructive — proposal/design flagged this as dev-only.
-- ────────────────────────────────────────────────────────────────────────────
-- Lines & allocations (children of documents)
DELETE FROM "journal_lines";
DELETE FROM "payment_allocations";
DELETE FROM "purchase_details";
DELETE FROM "sale_details";
DELETE FROM "dispatch_details";

-- Accounting receivables/payables bookkeeping
DELETE FROM "accounts_receivable";
DELETE FROM "accounts_payable";

-- IVA books are periodId-scoped
DELETE FROM "iva_purchase_books";
DELETE FROM "iva_sales_books";

-- Documents that reference periods
DELETE FROM "dispatches";
DELETE FROM "payments";
DELETE FROM "purchases";
DELETE FROM "sales";
DELETE FROM "journal_entries";
DELETE FROM "account_balances";

-- Clean audit log rows referring to now-gone entities (optional, but keeps
-- the trail consistent post-reset).
DELETE FROM "audit_logs";

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Drop fiscal_periods (CASCADE removes all FKs referencing it)
-- ────────────────────────────────────────────────────────────────────────────
DROP TABLE "fiscal_periods" CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Recreate fiscal_periods with month, closedAt, closedBy
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_periods_month_check" CHECK ("month" BETWEEN 1 AND 12)
);

-- Indexes + unique constraint
CREATE UNIQUE INDEX "fiscal_periods_organizationId_year_month_key"
  ON "fiscal_periods"("organizationId", "year", "month");

CREATE INDEX "fiscal_periods_organizationId_status_idx"
  ON "fiscal_periods"("organizationId", "status");

-- FK: organization
ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: closedBy user (nullable, SET NULL on user delete per design)
ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_closedBy_fkey"
  FOREIGN KEY ("closedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Recreate the 8 FKs dropped by CASCADE
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "account_balances"
  ADD CONSTRAINT "account_balances_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispatches"
  ADD CONSTRAINT "dispatches_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "iva_purchase_books"
  ADD CONSTRAINT "iva_purchase_books_fiscalPeriodId_fkey"
  FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "iva_sales_books"
  ADD CONSTRAINT "iva_sales_books_fiscalPeriodId_fkey"
  FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Add audit_logs.correlationId + supporting index
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" ADD COLUMN "correlationId" TEXT;
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Extend audit_trigger_fn() to read app.correlation_id
--    CREATE OR REPLACE — idempotent; preserves existing trigger attachments.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_user_id TEXT;
  v_justification TEXT;
  v_correlation_id TEXT;
  v_org_id TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  -- Read session variables (safe — returns NULL if not set)
  v_user_id := current_setting('app.current_user_id', true);
  v_justification := current_setting('app.audit_justification', true);
  v_correlation_id := current_setting('app.correlation_id', true);
  -- current_setting returns empty string when the var exists but is empty;
  -- normalize to NULL to keep the column cleanly nullable.
  IF v_correlation_id = '' THEN
    v_correlation_id := NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
    v_org_id := OLD."organizationId";
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_org_id := NEW."organizationId";
  END IF;

  INSERT INTO audit_logs (id, "organizationId", "entityType", "entityId", action, "oldValues", "newValues", "changedById", justification, "correlationId", "createdAt")
  VALUES (
    gen_random_uuid()::text,
    v_org_id,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_action,
    v_old_json,
    v_new_json,
    v_user_id,
    v_justification,
    v_correlation_id,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) Attach new triggers: fiscal_periods, purchases
--    Dispatches / payments / journal_entries triggers already exist from
--    20260406010241_monthly_close_audit_trail.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER audit_fiscal_periods
  AFTER UPDATE OR DELETE ON fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_purchases
  AFTER UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
