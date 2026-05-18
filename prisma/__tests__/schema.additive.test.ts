/**
 * T1 RED — Additive schema test for retire-farm-collapse-to-lot F1.
 *
 * Asserts that prisma/schema.prisma has been updated to add
 * the new nullable fields to ChickenLot as part of the D-1 additive phase:
 *   - farmName  String?
 *   - memberId  String?
 *   - @@index([memberId])
 *
 * These are structural (text) tests — not DB round-trips.
 * They act as cementación gate: if someone removes the fields, tests break.
 *
 * Expected FAIL (RED): the schema does not yet contain these fields.
 * After GREEN edit they must all match.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const schemaPath = path.resolve(__dirname, "../schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf-8");

// Extract the ChickenLot model block for scoped assertions
function extractModelBlock(src: string, modelName: string): string {
  const start = src.indexOf(`model ${modelName} {`);
  if (start === -1) return "";
  let depth = 0;
  let i = start;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
    i++;
  }
  return src.slice(start);
}

const chickenLotBlock = extractModelBlock(schema, "ChickenLot");
const orgMemberBlock = extractModelBlock(schema, "OrganizationMember");

describe("schema.additive — ChickenLot nullable fields (D-1 additive)", () => {
  it("ChickenLot has farmName String? field", () => {
    expect(chickenLotBlock).toMatch(/farmName\s+String\?/);
  });

  it("ChickenLot has memberId String? field", () => {
    expect(chickenLotBlock).toMatch(/memberId\s+String\?/);
  });

  it("ChickenLot has @@index([memberId])", () => {
    expect(chickenLotBlock).toMatch(/@@index\(\[memberId\]\)/);
  });

  it("ChickenLot still has farmId (additive — no drops)", () => {
    expect(chickenLotBlock).toMatch(/farmId\s+String/);
  });

  it("OrganizationMember has chickenLots inverse relation", () => {
    expect(orgMemberBlock).toMatch(/chickenLots\s+ChickenLot\[\]/);
  });
});
