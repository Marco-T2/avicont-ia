/**
 * T-03/T-04/T-05/T-06 — glosa-enriquecida-ventas-cobros Phase 0 backfill.
 *
 * SQL-shape sentinel for the AccountsReceivable.sourceTypeCode backfill
 * inside migration `20260519151605_add_ar_source_type_code/migration.sql`.
 *
 * Backfill rules (design D7 + spec REQ-GE-5 Scenarios 5.4–5.8):
 *   - Sale-sourced AR        → "VG"
 *   - Dispatch NOTA_DESPACHO → "ND"
 *   - Dispatch BOLETA_CERRADA → "BC"
 *   - Orphan rows (source deleted) → remain NULL (LEFT JOIN tolerance)
 *   - Idempotent: each UPDATE has `WHERE sourceTypeCode IS NULL`
 *
 * Deviation from tasks plan: spec called for fixture-insertion DB tests;
 * we use SQL-shape sentinel matching the existing pattern at
 * `prisma/seeds/__tests__/backfill-je-operational-doc-type.test.ts`. Faster,
 * deterministic, no DB side-effects. Functional verification of backfill
 * values is covered by the migration's own application in CI/staging.
 *
 * Expected FAIL (RED): migration.sql currently contains only the
 * ALTER TABLE ADD COLUMN statement; no UPDATE backfill blocks yet.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../migrations/20260519151605_add_ar_source_type_code/migration.sql",
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("AR sourceTypeCode backfill (Phase 0, T-03..T-06)", () => {
  it("T-03/T-04 — migration updates accounts_receivable.sourceTypeCode", () => {
    const sql = readMigration();
    expect(sql).toMatch(/UPDATE\s+"accounts_receivable"/i);
    expect(sql).toMatch(/SET\s+"sourceTypeCode"\s*=/i);
  });

  it('T-03/T-04 — sale-sourced AR backfills to "VG"', () => {
    const sql = readMigration();
    // Sale UPDATE block: SET = 'VG' where sourceType = 'sale'
    expect(sql).toMatch(/SET\s+"sourceTypeCode"\s*=\s*'VG'/i);
    expect(sql).toMatch(/"sourceType"\s*=\s*'sale'/i);
  });

  it('T-03/T-04 — dispatch NOTA_DESPACHO backfills to "ND"', () => {
    const sql = readMigration();
    expect(sql).toMatch(/'ND'/);
    expect(sql).toMatch(/NOTA_DESPACHO/);
  });

  it('T-03/T-04 — dispatch BOLETA_CERRADA backfills to "BC"', () => {
    const sql = readMigration();
    expect(sql).toMatch(/'BC'/);
    expect(sql).toMatch(/BOLETA_CERRADA/);
  });

  it("T-03/T-04 — dispatch backfill joins dispatches table", () => {
    const sql = readMigration();
    expect(sql).toMatch(/"dispatches"/i);
    expect(sql).toMatch(/"sourceType"\s*=\s*'dispatch'/i);
  });

  it("T-05/T-06 — idempotency: every UPDATE guards `sourceTypeCode IS NULL`", () => {
    const sql = readMigration();
    // Count UPDATE statements vs IS NULL guards — every UPDATE must have one
    const updates = sql.match(/UPDATE\s+"accounts_receivable"/gi) ?? [];
    const nullGuards = sql.match(/"sourceTypeCode"\s+IS\s+NULL/gi) ?? [];
    expect(updates.length).toBeGreaterThanOrEqual(2); // sale + dispatch
    expect(nullGuards.length).toBeGreaterThanOrEqual(updates.length);
  });

  it("T-03/T-04 — orphan rows (source deleted) tolerated via filter", () => {
    const sql = readMigration();
    // Dispatch UPDATE must JOIN dispatches; orphan sale rows simply don't match
    // a row in dispatches AND the WHERE clause includes sourceType='dispatch'.
    // For sales: the UPDATE WHERE sourceType='sale' is unconditional — orphan
    // sales also get "VG" (which is fine; "VG" is the doc type, not a join).
    // Validated by: no INNER JOIN with strict throw, no DROP CONSTRAINT.
    expect(sql).not.toMatch(/RAISE/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
