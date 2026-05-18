import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 4/4 — PrismaLotRepository + lot.mapper post-collapse
 * shape (D-5). Anchored on REQ-200/201/202 + D-1 additive bridge.
 * Regex-only file shape check; companions to the behaviour tests
 * in lot.mapper.test.ts and prisma-lot.repository.test.ts.
 */
const MAPPER = resolve(__dirname, "..", "lot.mapper.ts");
const REPO = resolve(__dirname, "..", "prisma-lot.repository.ts");

describe("PrismaLot mapper + repository — post-collapse shape (cementación 4/4, D-5)", () => {
  it("lot.mapper toDomain hydrates farmName + memberId from the row", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*row\.farmName\s*\?\?\s*""/);
    expect(src).toMatch(/memberId:\s*row\.memberId\s*\?\?\s*""/);
  });

  it("lot.mapper toPersistence writes farmName + memberId + legacy farmId sentinel (D-1 bridge)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*s\.farmName/);
    expect(src).toMatch(/memberId:\s*s\.memberId/);
    expect(src).toMatch(/farmId:\s*entity\._legacyFarmId/);
  });

  it("lot.mapper translates Prisma CLOSED|SOLD → domain INACTIVE on read (REQ-202 + D-1 bridge)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/dbToDomainStatus/);
    // both legacy values collapse — sentinel return at the bottom of
    // the helper covers CLOSED + SOLD with the `return "INACTIVE"` line
    expect(src).toMatch(
      /function dbToDomainStatus[\s\S]*?return "INACTIVE";[\s\S]*?\}/m,
    );
  });

  it("lot.mapper translates domain INACTIVE → Prisma CLOSED on write (REQ-202 + D-1 bridge)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(
      /function domainToDbStatus[\s\S]*?return "CLOSED";[\s\S]*?\}/m,
    );
  });

  it("prisma-lot.repository does NOT declare findByFarm (REQ-205, T10)", () => {
    const src = readFileSync(REPO, "utf-8");
    expect(src).not.toMatch(/^\s*async findByFarm\(/m);
  });

  it("prisma-lot.repository update omits the legacy farmId column (immutable post-create)", () => {
    const src = readFileSync(REPO, "utf-8");
    // update() block writes farmName but not farmId in its data payload
    expect(src).toMatch(
      /async update\(entity: Lot\)[\s\S]*?data:\s*\{[\s\S]*?farmName:[\s\S]*?\},/m,
    );
    // assert farmId NOT in the update data block specifically
    const updateBlock = src.match(
      /async update\(entity: Lot\)[\s\S]*?await this\.db\.chickenLot\.update\(\{[\s\S]*?\}\);[\s\S]*?\}/m,
    )?.[0];
    expect(updateBlock).toBeTruthy();
    expect(updateBlock!).not.toMatch(/farmId:\s*data\.farmId/);
  });
});
