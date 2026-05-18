import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 4/4 — PrismaLotRepository + lot.mapper post simplify-lot-identifier
 * shape. Originally anchored on retire-farm-collapse-to-lot F5-final state;
 * the apply-directo refresh tightens the assertions for the new column
 * surface: no `name`/`barnNumber` in either direction, plus the
 * (orgId, farmName, startDate) unique index → P2002 mapping to
 * LotForFarmAtDateExists is wired in the repo adapter.
 */
const MAPPER = resolve(__dirname, "..", "lot.mapper.ts");
const REPO = resolve(__dirname, "..", "prisma-lot.repository.ts");

describe("PrismaLot mapper + repository — post simplify-lot-identifier shape (cementación 4/4)", () => {
  it("lot.mapper toDomain hydrates farmName + memberId (no name/barnNumber)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*row\.farmName,/);
    expect(src).toMatch(/memberId:\s*row\.memberId,/);
    expect(src).not.toMatch(/^\s*name:\s*row\.name,/m);
    expect(src).not.toMatch(/^\s*barnNumber:\s*row\.barnNumber,/m);
  });

  it("lot.mapper toPersistence writes farmName + memberId; no legacy name/barnNumber/farmId payload", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*s\.farmName,/);
    expect(src).toMatch(/memberId:\s*s\.memberId,/);
    expect(src).not.toMatch(/^\s*name:\s*s\.name,/m);
    expect(src).not.toMatch(/^\s*barnNumber:\s*s\.barnNumber,/m);
    expect(src).not.toMatch(/^\s*farmId:\s/m);
  });

  it("lot.mapper does NOT translate Prisma status (enum 1:1 ACTIVE | INACTIVE)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).not.toMatch(/function\s+dbToDomainStatus\b/);
    expect(src).not.toMatch(/function\s+domainToDbStatus\b/);
    expect(src).toMatch(/status:\s*parseLotStatus\(row\.status\)/);
    expect(src).toMatch(/status:\s*s\.status,/);
  });

  it("prisma-lot.repository does NOT declare findByFarm (REQ-205, T10)", () => {
    const src = readFileSync(REPO, "utf-8");
    expect(src).not.toMatch(/^\s*async findByFarm\(/m);
  });

  it("prisma-lot.repository update writes farmName but no legacy name/barnNumber/farmId (post-simplify)", () => {
    const src = readFileSync(REPO, "utf-8");
    expect(src).toMatch(
      /async update\(entity: Lot\)[\s\S]*?data:\s*\{[\s\S]*?farmName:[\s\S]*?\},/m,
    );
    const updateBlock = src.match(
      /async update\(entity: Lot\)[\s\S]*?await this\.db\.chickenLot\.update\(\{[\s\S]*?\}\);[\s\S]*?\}/m,
    )?.[0];
    expect(updateBlock).toBeTruthy();
    expect(updateBlock!).not.toMatch(/\bfarmId\b/);
    expect(updateBlock!).not.toMatch(/^\s*name:[^\n]*$/m);
    expect(updateBlock!).not.toMatch(/^\s*barnNumber:[^\n]*$/m);
  });

  it("prisma-lot.repository wires P2002 → LotForFarmAtDateExists on the unique index", () => {
    const src = readFileSync(REPO, "utf-8");
    expect(src).toMatch(/LotForFarmAtDateExists/);
    expect(src).toMatch(
      /chicken_lots_organizationId_farmName_startDate_key/,
    );
  });
});
