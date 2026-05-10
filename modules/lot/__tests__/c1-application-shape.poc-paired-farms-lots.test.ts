import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOT_ROOT = resolve(__dirname, "..");

function readLotFile(rel: string): string {
  return readFileSync(resolve(LOT_ROOT, rel), "utf-8");
}

describe("C1 application shape — Lot module (existence-only regex)", () => {
  // α23
  it("LotService class is exported from application/lot.service.ts", () => {
    const src = readLotFile("application/lot.service.ts");
    expect(src).toMatch(/^export class LotService\b/m);
  });

  // α24
  it("LotService.list signature accepts only organizationId (no filters)", () => {
    const src = readLotFile("application/lot.service.ts");
    expect(src).toMatch(/list\(\s*organizationId: string\s*\)/m);
  });

  // α25
  it("LotService methods listByFarm/getById/create/close/getSummary exist", () => {
    const src = readLotFile("application/lot.service.ts");
    expect(src).toMatch(/async listByFarm\(/m);
    expect(src).toMatch(/async getById\(/m);
    expect(src).toMatch(/async create\(/m);
    expect(src).toMatch(/async close\(/m);
    expect(src).toMatch(/async getSummary\(/m);
  });

  // α26
  it("LotService.getSummary return shape is { lot: Lot; summary: LotSummary }", () => {
    const src = readLotFile("application/lot.service.ts");
    expect(src).toMatch(/getSummary\([^)]*\)\s*:\s*Promise<\s*\{\s*lot:\s*Lot;\s*summary:\s*LotSummary\s*\}\s*>/m);
  });

  // α27
  it("LotService constructor injects (repo: LotRepository) — no port dependencies", () => {
    const src = readLotFile("application/lot.service.ts");
    expect(src).toMatch(
      /constructor\(\s*private\s+(?:readonly\s+)?repo:\s*LotRepository\s*\)/m,
    );
  });
});
