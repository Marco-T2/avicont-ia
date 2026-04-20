/**
 * T1 — Migration smoke test for contra-account flag.
 *
 * Asserts that after running `prisma migrate dev`, the following
 * DB schema changes exist:
 *   - column "isContraAccount" on table "accounts" with default false
 *
 * This test touches the real DB via raw SQL against pg_catalog. Read-only
 * schema introspection — no rows are inserted or deleted.
 *
 * Covers: REQ-CA.1 (schema), REQ-CA.5 (column default for existing rows)
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    tableName,
    columnName,
  );
  return rows[0]?.exists === true;
}

async function columnDefault(tableName: string, columnName: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_default: string | null }>>(
    `SELECT column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    tableName,
    columnName,
  );
  return rows[0]?.column_default ?? null;
}

async function columnIsNullable(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    tableName,
    columnName,
  );
  return rows[0]?.is_nullable === "YES";
}

describe("Migration smoke — contra-account flag", () => {
  it("isContraAccount column exists on accounts table", async () => {
    expect(await columnExists("accounts", "isContraAccount")).toBe(true);
  });

  it("isContraAccount column is NOT NULL (non-nullable)", async () => {
    expect(await columnIsNullable("accounts", "isContraAccount")).toBe(false);
  });

  it("isContraAccount column has default false", async () => {
    const def = await columnDefault("accounts", "isContraAccount");
    // Postgres stores boolean defaults as "false" or "true"
    expect(def).toBe("false");
  });
});
