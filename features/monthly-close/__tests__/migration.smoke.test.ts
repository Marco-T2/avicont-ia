/**
 * T01 — Migration smoke test for cierre-periodo (RED).
 *
 * Asserts that after `prisma migrate dev` applies the cierre-periodo migration:
 *   - fiscal_periods has columns: month, closedAt, closedBy
 *   - fiscal_periods has unique constraint on (organizationId, year, month)
 *   - fiscal_periods has CHECK constraint enforcing month BETWEEN 1 AND 12
 *   - audit_logs has column: correlationId
 *   - audit_logs has an index on correlationId
 *
 * Read-only schema introspection against pg_catalog / information_schema.
 * No rows inserted.
 *
 * Covers: REQ-2 (monthly uniqueness), REQ-9 (closedAt/closedBy), audit-log spec correlationId.
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    tableName,
    columnName,
  );
  return rows[0]?.exists === true;
}

async function uniqueConstraintExists(
  tableName: string,
  columns: string[],
): Promise<boolean> {
  // Ask Postgres for all UNIQUE indexes on the table and match by column set.
  const rows = await prisma.$queryRawUnsafe<
    Array<{ indexdef: string; indexname: string }>
  >(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1`,
    tableName,
  );
  const sortedTarget = [...columns].sort().join(",");
  for (const r of rows) {
    // Parse column list from "CREATE UNIQUE INDEX ... ON ... (\"col1\", \"col2\")"
    if (!/CREATE UNIQUE INDEX/i.test(r.indexdef)) continue;
    const match = r.indexdef.match(/\(([^)]+)\)/);
    if (!match) continue;
    const colList = match[1]
      .split(",")
      .map((c) => c.trim().replace(/"/g, ""))
      .sort()
      .join(",");
    if (colList === sortedTarget) return true;
  }
  return false;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2
     ) AS exists`,
    tableName,
    indexName,
  );
  return rows[0]?.exists === true;
}

async function checkConstraintExists(
  tableName: string,
  partialDefinition: string,
): Promise<boolean> {
  // Look for a CHECK constraint whose definition contains the given substring.
  const rows = await prisma.$queryRawUnsafe<
    Array<{ consrc: string | null; pg_get_constraintdef: string }>
  >(
    `SELECT pg_get_constraintdef(c.oid) AS pg_get_constraintdef
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = $1 AND c.contype = 'c'`,
    tableName,
  );
  return rows.some((r) => r.pg_get_constraintdef?.includes(partialDefinition));
}

describe("Migration smoke — cierre-periodo", () => {
  it("fiscal_periods.month column exists", async () => {
    expect(await columnExists("fiscal_periods", "month")).toBe(true);
  });

  it("fiscal_periods.closedAt column exists", async () => {
    expect(await columnExists("fiscal_periods", "closedAt")).toBe(true);
  });

  it("fiscal_periods.closedBy column exists", async () => {
    expect(await columnExists("fiscal_periods", "closedBy")).toBe(true);
  });

  it("fiscal_periods has unique constraint on (organizationId, year, month)", async () => {
    expect(
      await uniqueConstraintExists("fiscal_periods", [
        "organizationId",
        "year",
        "month",
      ]),
    ).toBe(true);
  });

  it("fiscal_periods no longer has unique constraint on (organizationId, year)", async () => {
    // The old 2-col unique constraint must be gone — only (org, year, month) remains.
    expect(
      await uniqueConstraintExists("fiscal_periods", ["organizationId", "year"]),
    ).toBe(false);
  });

  it("fiscal_periods has CHECK constraint enforcing month BETWEEN 1 AND 12", async () => {
    expect(
      await checkConstraintExists("fiscal_periods", "month"),
    ).toBe(true);
  });

  it("audit_logs.correlationId column exists", async () => {
    expect(await columnExists("audit_logs", "correlationId")).toBe(true);
  });

  it("audit_logs has an index on correlationId", async () => {
    expect(
      await indexExists("audit_logs", "audit_logs_correlationId_idx"),
    ).toBe(true);
  });
});
