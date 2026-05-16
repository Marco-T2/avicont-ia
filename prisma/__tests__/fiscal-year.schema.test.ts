/**
 * Phase 1.1 — annual-close schema integration test (post-fix-forward).
 *
 * Asserts that after the `annual_close` migrations run, the following Postgres
 * objects are in the design-correct state:
 *   - enum `FiscalYearStatus` with exactly the values [OPEN, CLOSED]
 *   - table `fiscal_years`
 *   - column `fiscal_periods.fiscalYearId` does NOT exist — design rev 2 §2
 *     keeps the FiscalYear ↔ FiscalPeriod link LOGICAL via (organizationId, year)
 *     joined against fiscal_years.@@unique([organizationId, year]); v1 has no
 *     physical FK column on fiscal_periods (per proposal §11 OUT).
 *   - `prisma.fiscalYear.findMany({ take: 0 })` runs without throwing
 *     (proves the Prisma client knows the model)
 *
 * Read-only schema introspection via `pg_catalog` and `information_schema`
 * (no rows inserted or deleted). Sister of
 * `prisma/__tests__/migration-smoke.test.ts` (organization-profile pattern).
 *
 * Covers: REQ-1.1 (FiscalYear aggregate fields), REQ-1.3 first-touch
 * (table existence — backfill semantics validated in Phase 1.4).
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function enumValues(enumName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = $1
     ORDER BY e.enumsortorder`,
    enumName,
  );
  return rows.map((r) => r.enumlabel);
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    tableName,
  );
  return rows[0]?.exists === true;
}

async function columnInfo(
  tableName: string,
  columnName: string,
): Promise<{ exists: boolean; isNullable: string | null; dataType: string | null }> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ is_nullable: string; data_type: string }>
  >(
    `SELECT is_nullable, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    tableName,
    columnName,
  );
  if (rows.length === 0) return { exists: false, isNullable: null, dataType: null };
  return {
    exists: true,
    isNullable: rows[0].is_nullable,
    dataType: rows[0].data_type,
  };
}

describe("annual-close migration smoke — fiscal_years schema (REQ-1.1)", () => {
  it("FiscalYearStatus enum exists with exactly [OPEN, CLOSED]", async () => {
    const values = await enumValues("FiscalYearStatus");
    expect(values).toEqual(["OPEN", "CLOSED"]);
  });

  it("fiscal_years table exists", async () => {
    expect(await tableExists("fiscal_years")).toBe(true);
  });

  it("fiscal_periods.fiscalYearId column does NOT exist (design rev 2 §2 — logical link only)", async () => {
    const col = await columnInfo("fiscal_periods", "fiscalYearId");
    expect(col.exists).toBe(false);
  });

  it("prisma.fiscalYear model is queryable (findMany({take:0}) does not throw)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).fiscalYear.findMany({ take: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});
