/**
 * T2 RED — Additive migration file presence and content test.
 *
 * Asserts that the migration for retire-farm-collapse-to-lot F1 exists and
 * contains the expected additive SQL statements:
 *   - ADD COLUMN "farmName"  TEXT (nullable)
 *   - ADD COLUMN "memberId"  TEXT (nullable)
 *   - CREATE INDEX on chicken_lots(memberId)
 *
 * No destructive SQL (DROP TABLE, DROP COLUMN, ALTER TYPE recreate) must be
 * present — this is additive-only per D-1 override.
 *
 * Expected FAIL (RED): migration directory/file does not yet exist.
 * After GREEN (pnpm prisma migrate dev --create-only) they must all match.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const migrationsDir = path.resolve(__dirname, "../migrations");

function findAdditiveMigration(): string | null {
  if (!fs.existsSync(migrationsDir)) return null;
  const entries = fs.readdirSync(migrationsDir);
  const dir = entries.find((e) => e.includes("add_lot_farmname_memberid"));
  if (!dir) return null;
  const sqlPath = path.join(migrationsDir, dir, "migration.sql");
  return fs.existsSync(sqlPath) ? sqlPath : null;
}

describe("additive-migration — chicken_lots farmName + memberId (D-1 additive)", () => {
  it("migration directory exists (name contains add_lot_farmname_memberid)", () => {
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`migrations dir not found: ${migrationsDir}`);
    }
    const entries = fs.readdirSync(migrationsDir);
    const found = entries.find((e) => e.includes("add_lot_farmname_memberid"));
    expect(found).toBeDefined();
  });

  it("migration.sql file exists inside the migration directory", () => {
    const sqlPath = findAdditiveMigration();
    expect(sqlPath).not.toBeNull();
    expect(fs.existsSync(sqlPath!)).toBe(true);
  });

  it('SQL adds "farmName" column to chicken_lots', () => {
    const sqlPath = findAdditiveMigration();
    expect(sqlPath).not.toBeNull();
    const sql = fs.readFileSync(sqlPath!, "utf-8");
    expect(sql).toMatch(/ADD COLUMN.*"farmName"/i);
  });

  it('SQL adds "memberId" column to chicken_lots', () => {
    const sqlPath = findAdditiveMigration();
    expect(sqlPath).not.toBeNull();
    const sql = fs.readFileSync(sqlPath!, "utf-8");
    expect(sql).toMatch(/ADD COLUMN.*"memberId"/i);
  });

  it("SQL creates index on chicken_lots(memberId)", () => {
    const sqlPath = findAdditiveMigration();
    expect(sqlPath).not.toBeNull();
    const sql = fs.readFileSync(sqlPath!, "utf-8");
    expect(sql).toMatch(/CREATE INDEX[^\n]*"chicken_lots_memberId_idx"[^\n]*"chicken_lots"[^\n]*"memberId"/i);
  });

  it("SQL does NOT drop the farms table (additive-only gate)", () => {
    const sqlPath = findAdditiveMigration();
    if (!sqlPath) return; // skip if file not yet created (RED state)
    const sql = fs.readFileSync(sqlPath!, "utf-8");
    expect(sql).not.toMatch(/DROP TABLE.*farms/i);
  });

  it("SQL does NOT drop farmId column (additive-only gate)", () => {
    const sqlPath = findAdditiveMigration();
    if (!sqlPath) return;
    const sql = fs.readFileSync(sqlPath!, "utf-8");
    expect(sql).not.toMatch(/DROP COLUMN.*"farmId"/i);
  });
});
