import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 1/4 — Lot entity post-collapse shape (D-5).
 *
 * Anchored on the SDD `retire-farm-collapse-to-lot` REQ-200/201/203
 * + INV-04. Regex-only file shape check, NOT a behaviour test;
 * companion to `lot.entity.test.ts` which covers semantics.
 */
const ENTITY = resolve(
  __dirname,
  "..",
  "lot.entity.ts",
);

function readSrc(): string {
  return readFileSync(ENTITY, "utf-8");
}

describe("Lot entity — post-collapse shape (cementación 1/4, D-5)", () => {
  it("declares public farmName getter (REQ-200) + memberId getter (REQ-201)", () => {
    const src = readSrc();
    expect(src).toMatch(/^\s*get farmName\(\):\s*string\s*\{/m);
    expect(src).toMatch(/^\s*get memberId\(\):\s*string\s*\{/m);
  });

  it("does NOT expose a public `get farmId()` (post-collapse REQ-200)", () => {
    const src = readSrc();
    expect(src).not.toMatch(/^\s*get farmId\(\):/m);
  });

  it("exposes the deactivate() method (REQ-203, D-4) and NOT close()", () => {
    const src = readSrc();
    expect(src).toMatch(/^\s*deactivate\(endDate:\s*Date\):\s*Lot\s*\{/m);
    expect(src).not.toMatch(/^\s*close\(endDate:\s*Date\):\s*Lot\s*\{/m);
  });

  it("CreateLotInput requires farmName + memberId; no farmId field", () => {
    const src = readSrc();
    expect(src).toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?farmName:\s*string;[\s\S]*?memberId:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?farmId:\s*string;[\s\S]*?\}/m,
    );
  });

  it("LotSnapshot exposes farmName + memberId; NO farmId (port projection)", () => {
    const src = readSrc();
    expect(src).toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?farmName:\s*string;[\s\S]*?memberId:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?farmId:\s*string;[\s\S]*?\}/m,
    );
  });

  it("Lot.update accepts farmName? (INV-04 expanded — farmName mutable)", () => {
    const src = readSrc();
    expect(src).toMatch(/farmName\?:\s*string;/);
  });
});
