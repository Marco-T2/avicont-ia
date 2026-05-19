/**
 * T-01 RED — glosa-enriquecida-ventas-cobros Phase 0.
 *
 * Asserts that `accounts_receivable` table has a nullable text column
 * `sourceTypeCode` (denormalized doc type for glosa builder LOOKUP-B per
 * design D7 + REQ-GE-5).
 *
 * Read-only schema introspection via `information_schema.columns`.
 *
 * Expected FAIL (RED): column `sourceTypeCode` does not yet exist on
 * `accounts_receivable`.
 *
 * On GREEN (T-02): prisma migrate adds the column nullable; this passes.
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

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

describe("accounts-receivable migration — sourceTypeCode (REQ-GE-5, D7)", () => {
  it("accounts_receivable.sourceTypeCode column exists (nullable text)", async () => {
    const col = await columnInfo("accounts_receivable", "sourceTypeCode");
    expect(col.exists).toBe(true);
    expect(col.isNullable).toBe("YES");
    expect(col.dataType).toBe("text");
  });
});
