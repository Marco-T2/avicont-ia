/**
 * Backfill M-D shape sentinel (journal-physical-document Phase 3)
 *
 * The historic JournalEntry backfill (`prisma/migrations/20260518150300_
 * backfill_je_operational_doc_type/migration.sql`) MUST:
 *
 *  - Derive `operationalDocTypeId` for sourceType ∈ {sale, purchase, dispatch,
 *    payment} by joining the source row → operational_doc_types.code.
 *  - Tolerate orphan sourceId via LEFT JOIN — rows whose source no longer
 *    exists keep operationalDocTypeId NULL (I-5: never throw).
 *  - Leave sourceType=NULL rows (manual entries) untouched.
 *  - For sourceType='payment' use Payment.operationalDocTypeId directly when
 *    set (no code lookup needed — Payment carries the FK already).
 *
 * This is a SQL-shape sentinel; runtime semantics are exercised by the repo
 * integration test in Phase 5.1.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../migrations/20260518150300_backfill_je_operational_doc_type/migration.sql",
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("backfill M-D shape (journal-physical-document Phase 3)", () => {
  it("3.2-S1 — updates journal_entries.operationalDocTypeId", () => {
    const sql = readMigration();
    expect(sql).toMatch(/UPDATE\s+"journal_entries"/i);
    expect(sql).toMatch(/SET\s+"operationalDocTypeId"\s*=/i);
  });

  it("3.2-S2 — joins each upstream source table (sale, purchase, dispatch, payment)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/"sales"/i);
    expect(sql).toMatch(/"purchases"/i);
    expect(sql).toMatch(/"dispatches"/i);
    expect(sql).toMatch(/"payments"/i);
  });

  it("3.2-S3 — joins operational_doc_types by (organizationId, code)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/"operational_doc_types"/i);
    // Per-source JOIN ON odt.organizationId = ... AND odt.code = ...
    expect(sql).toMatch(/"organizationId"/);
    expect(sql).toMatch(/"code"/);
  });

  it("3.2-S4 — LEFT JOIN for orphan tolerance (I-5: backfill never throws)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/LEFT\s+JOIN/i);
  });

  it("3.2-S5 — leaves sourceType=NULL (manual entries) alone via discriminated subquery", () => {
    const sql = readMigration();
    // The subquery filter must restrict to one of the four known sourceTypes,
    // so any other sourceType (or NULL) is implicitly excluded from the UPDATE.
    expect(sql).toMatch(/'sale'/);
    expect(sql).toMatch(/'purchase'/);
    expect(sql).toMatch(/'dispatch'/);
    expect(sql).toMatch(/'payment'/);
  });

  it("3.2-S6 — Payment branch reads Payment.operationalDocTypeId directly", () => {
    const sql = readMigration();
    // The payment branch must reference the Payment FK column directly so
    // legacy Payment rows with operationalDocTypeId already set propagate
    // verbatim (spec scenario "Payment JE with existing operationalDocTypeId").
    expect(sql).toMatch(/p\."operationalDocTypeId"/);
  });

  it("3.2-S7 — restricts to rows with operationalDocTypeId IS NULL (no overwrite)", () => {
    const sql = readMigration();
    // Tighter guard: only fill rows that are still null after M-B; never
    // overwrite anything an admin already set via UI/API post-deploy.
    expect(sql).toMatch(/"operationalDocTypeId"\s+IS\s+NULL/i);
  });
});
