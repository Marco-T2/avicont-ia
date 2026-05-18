import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 4/4 — PrismaLotRepository + lot.mapper post-collapse
 * shape (D-5). Anchored on REQ-200/201/202 final state (post F5-final
 * destructive migration). Regex-only file shape check; companions to
 * the behaviour tests in lot.mapper.test.ts and prisma-lot.repository.test.ts.
 */
const MAPPER = resolve(__dirname, "..", "lot.mapper.ts");
const REPO = resolve(__dirname, "..", "prisma-lot.repository.ts");

describe("PrismaLot mapper + repository — post-collapse shape (cementación 4/4, D-5)", () => {
  it("lot.mapper toDomain hydrates farmName + memberId from the row (1:1 pass-through)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*row\.farmName,/);
    expect(src).toMatch(/memberId:\s*row\.memberId,/);
  });

  it("lot.mapper toPersistence writes farmName + memberId; no legacy farmId payload", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).toMatch(/farmName:\s*s\.farmName,/);
    expect(src).toMatch(/memberId:\s*s\.memberId,/);
    // Post F5-final: no `farmId:` write at all (legacy column dropped).
    expect(src).not.toMatch(/^\s*farmId:\s/m);
  });

  it("lot.mapper does NOT translate Prisma status (enum 1:1 ACTIVE | INACTIVE post-F5)", () => {
    const src = readFileSync(MAPPER, "utf-8");
    expect(src).not.toMatch(/function\s+dbToDomainStatus\b/);
    expect(src).not.toMatch(/function\s+domainToDbStatus\b/);
    // status pass-through both directions
    expect(src).toMatch(/status:\s*parseLotStatus\(row\.status\)/);
    expect(src).toMatch(/status:\s*s\.status,/);
  });

  it("prisma-lot.repository does NOT declare findByFarm (REQ-205, T10)", () => {
    const src = readFileSync(REPO, "utf-8");
    expect(src).not.toMatch(/^\s*async findByFarm\(/m);
  });

  it("prisma-lot.repository update omits the legacy farmId column (post F5-final drop)", () => {
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
    expect(updateBlock!).not.toMatch(/\bfarmId\b/);
  });
});
