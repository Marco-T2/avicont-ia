-- ============================================================
-- Migration: annual_close — FiscalYear aggregate + backfill from fiscal_periods
-- ============================================================
--
-- WHY:
--   Introduces the FiscalYear aggregate so an organization can lock a fiscal
--   year via "Cierre de Gestión" (annual close). Loose link FiscalPeriod →
--   FiscalYear is materialised as a NOT NULL FK so the year aggregate is
--   queryable per-period without a manual join on (organizationId, year).
--
--   The FK is added in the staged sequence required by Postgres for tables
--   with existing rows:
--      (1) ADD COLUMN fiscalYearId TEXT NULL
--      (2) backfill — INSERT one FiscalYear per distinct (orgId, year) AND
--          UPDATE fiscal_periods.fiscalYearId via the natural join
--      (3) ALTER COLUMN NOT NULL + ADD CONSTRAINT FK
--
-- BACKFILL SEMANTICS (spec REQ-1.3, design OQ #4 — conservative):
--   For each distinct (organizationId, year) in fiscal_periods, insert ONE
--   fiscal_years row. status = CLOSED iff exactly 12 periods exist for that
--   pair AND all 12 are CLOSED; otherwise OPEN. closingEntryId /
--   openingEntryId remain NULL (no historical CC/CA backfill in v1).
--
-- IDEMPOTENCE:
--   Re-applying this migration on a fresh DB is a no-op for the schema (Prisma
--   tracks _prisma_migrations). The backfill INSERT is naturally idempotent on
--   re-run because the unique (organizationId, year) index would reject dupes;
--   we use ON CONFLICT DO NOTHING for safety.
--
-- AUDIT:
--   audit_fiscal_years trigger mirrors audit_fiscal_periods (AFTER UPDATE OR
--   DELETE, FOR EACH ROW). INSERT is NOT audited — consistent with the policy
--   for fiscal_periods (see ADR in 20260424123854_audit_insert_coverage_completion).
--
-- DOWN:
--   See ./down.sql — documented rollback (NOT auto-applied by Prisma).
-- ============================================================

-- ── 1) Enum ──────────────────────────────────────────────────────────────────
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- ── 2) fiscal_years table ────────────────────────────────────────────────────
CREATE TABLE "fiscal_years" (
  "id"              TEXT PRIMARY KEY,
  "organizationId"  TEXT NOT NULL,
  "year"            INTEGER NOT NULL,
  "status"          "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt"        TIMESTAMPTZ(3),
  "closedBy"        TEXT,
  "closingEntryId"  TEXT,
  "openingEntryId"  TEXT,
  "justification"   TEXT,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ(3) NOT NULL,  -- @updatedAt managed by Prisma, no DB default

  CONSTRAINT "fiscal_years_year_range_check"        CHECK ("year" BETWEEN 1900 AND 2100),
  CONSTRAINT "fiscal_years_organizationId_fkey"     FOREIGN KEY ("organizationId")  REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fiscal_years_closedBy_fkey"           FOREIGN KEY ("closedBy")        REFERENCES "users"         ("id") ON DELETE SET NULL  ON UPDATE CASCADE,
  CONSTRAINT "fiscal_years_createdById_fkey"        FOREIGN KEY ("createdById")     REFERENCES "users"         ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fiscal_years_closingEntryId_fkey"     FOREIGN KEY ("closingEntryId")  REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fiscal_years_openingEntryId_fkey"     FOREIGN KEY ("openingEntryId")  REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fiscal_years_organizationId_year_key"
  ON "fiscal_years" ("organizationId", "year");

CREATE INDEX "fiscal_years_organizationId_status_idx"
  ON "fiscal_years" ("organizationId", "status");

-- 1:1 unique indexes: each CC/CA journal_entry belongs to at most one FiscalYear
CREATE UNIQUE INDEX "fiscal_years_closingEntryId_key"
  ON "fiscal_years" ("closingEntryId");

CREATE UNIQUE INDEX "fiscal_years_openingEntryId_key"
  ON "fiscal_years" ("openingEntryId");

-- ── 3) Add nullable fiscalYearId column to fiscal_periods ────────────────────
ALTER TABLE "fiscal_periods"
  ADD COLUMN "fiscalYearId" TEXT;

-- ── 4) Backfill — one fiscal_years row per distinct (organizationId, year) ──
INSERT INTO "fiscal_years" (
  "id", "organizationId", "year", "status",
  "createdById", "createdAt", "updatedAt"
)
SELECT
  'fy_' || replace(gen_random_uuid()::text, '-', '')                               AS "id",
  fp."organizationId"                                                              AS "organizationId",
  fp."year"                                                                        AS "year",
  CASE
    WHEN COUNT(*) = 12
      AND COUNT(*) FILTER (WHERE fp."status" = 'CLOSED') = 12
    THEN 'CLOSED'::"FiscalYearStatus"
    ELSE 'OPEN'::"FiscalYearStatus"
  END                                                                              AS "status",
  MIN(fp."createdById")                                                            AS "createdById",
  MIN(fp."createdAt")                                                              AS "createdAt",
  MAX(fp."updatedAt")                                                              AS "updatedAt"
FROM "fiscal_periods" fp
GROUP BY fp."organizationId", fp."year"
ON CONFLICT ("organizationId", "year") DO NOTHING;

-- ── 5) Backfill fiscal_periods.fiscalYearId via the natural join ────────────
UPDATE "fiscal_periods" fp
SET "fiscalYearId" = fy."id"
FROM "fiscal_years" fy
WHERE fy."organizationId" = fp."organizationId"
  AND fy."year"           = fp."year";

-- ── 6) Enforce NOT NULL + FK now that every row has a value ─────────────────
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "fiscalYearId" SET NOT NULL;

ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_fiscalYearId_fkey"
    FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "fiscal_periods_fiscalYearId_idx"
  ON "fiscal_periods" ("fiscalYearId");

-- ── 7) Audit trigger — mirror audit_fiscal_periods (UPDATE/DELETE only) ─────
CREATE TRIGGER audit_fiscal_years
  AFTER UPDATE OR DELETE ON "fiscal_years"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
