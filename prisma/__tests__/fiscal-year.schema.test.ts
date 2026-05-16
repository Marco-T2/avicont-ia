/**
 * Phase 1.1 RED — annual-close schema integration test.
 *
 * Asserts that after the `annual_close` migration runs, the following Postgres
 * objects exist:
 *   - enum `FiscalYearStatus` with exactly the values [OPEN, CLOSED]
 *   - table `fiscal_years`
 *   - column `fiscal_periods.fiscalYearId` of type UUID/text NOT NULL
 *   - `prisma.fiscalYear.findMany({ take: 0 })` runs without throwing
 *     (proves the Prisma client knows the model)
 *
 * Read-only schema introspection via `pg_catalog` and `information_schema`
 * (no rows inserted or deleted). Sister of
 * `prisma/__tests__/migration-smoke.test.ts` (organization-profile pattern).
 *
 * Declared failure mode (per [[red_acceptance_failure_mode]]):
 *  - `findMany` throws because `prisma.fiscalYear` is undefined on the
 *    current generated client.
 *  - enum/table/column existence queries return empty arrays/false.
 * All four assertions FAIL pre-migration; flip to GREEN once Phase 1.2
 * lands the schema + migration and Phase 1.3 regenerates the client.
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

  it("fiscal_periods.fiscalYearId column exists and is NOT NULL", async () => {
    const col = await columnInfo("fiscal_periods", "fiscalYearId");
    expect(col.exists).toBe(true);
    expect(col.isNullable).toBe("NO");
  });

  it("prisma.fiscalYear model is queryable (findMany({take:0}) does not throw)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).fiscalYear.findMany({ take: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});
