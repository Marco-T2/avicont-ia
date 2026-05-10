import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FARM_ROOT = resolve(__dirname, "..");

function readFarmFile(rel: string): string {
  return readFileSync(resolve(FARM_ROOT, rel), "utf-8");
}

describe("C1 application shape — Farm module (existence-only regex)", () => {
  // α1
  it("FarmService class is exported from application/farm.service.ts", () => {
    const src = readFarmFile("application/farm.service.ts");
    expect(src).toMatch(/^export class FarmService\b/m);
  });

  // α2
  it("MemberInquiryPort type is exported from domain/ports/member-inquiry.port.ts", () => {
    const src = readFarmFile("domain/ports/member-inquiry.port.ts");
    expect(src).toMatch(/^export (interface|type) MemberInquiryPort\b/m);
  });

  // α3
  it("FarmService.list signature accepts optional FarmFilters {memberId}", () => {
    const src = readFarmFile("application/farm.service.ts");
    expect(src).toMatch(/list\(\s*organizationId: string,\s*filters\?: FarmFilters\s*\)/m);
  });

  // α4
  it("FarmService methods getById/create/update/delete exist", () => {
    const src = readFarmFile("application/farm.service.ts");
    expect(src).toMatch(/async getById\(/m);
    expect(src).toMatch(/async create\(/m);
    expect(src).toMatch(/async update\(/m);
    expect(src).toMatch(/async delete\(/m);
  });

  // α5
  it("FarmService constructor injects (repo: FarmRepository, members: MemberInquiryPort)", () => {
    const src = readFarmFile("application/farm.service.ts");
    expect(src).toMatch(
      /constructor\(\s*private\s+(?:readonly\s+)?repo:\s*FarmRepository,\s*private\s+(?:readonly\s+)?members:\s*MemberInquiryPort/m,
    );
  });
});
