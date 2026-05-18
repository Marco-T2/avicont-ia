import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 1/4 — Lot entity post simplify-lot-identifier shape.
 *
 * Originally anchored on retire-farm-collapse-to-lot REQ-200/201/203
 * + INV-04. The simplify-lot-identifier apply-directo refresh keeps
 * the same regex-only shape ethos and tightens the assertions for
 * the new public surface: no `name` getter, no `barnNumber` getter,
 * `displayName` derives from farmName + startDate.
 */
const ENTITY = resolve(
  __dirname,
  "..",
  "lot.entity.ts",
);

function readSrc(): string {
  return readFileSync(ENTITY, "utf-8");
}

describe("Lot entity — post simplify-lot-identifier shape (cementación 1/4)", () => {
  it("declares public farmName getter (REQ-200) + memberId getter (REQ-201) + displayName getter", () => {
    const src = readSrc();
    expect(src).toMatch(/^\s*get farmName\(\):\s*string\s*\{/m);
    expect(src).toMatch(/^\s*get memberId\(\):\s*string\s*\{/m);
    expect(src).toMatch(/^\s*get displayName\(\):\s*string\s*\{/m);
  });

  it("does NOT expose `get name()` or `get barnNumber()` (post simplify-lot-identifier)", () => {
    const src = readSrc();
    expect(src).not.toMatch(/^\s*get name\(\):/m);
    expect(src).not.toMatch(/^\s*get barnNumber\(\):/m);
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

  it("CreateLotInput requires farmName + memberId; no name/barnNumber/farmId fields", () => {
    const src = readSrc();
    expect(src).toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?farmName:\s*string;[\s\S]*?memberId:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?\bname:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?\bbarnNumber:\s*number;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface CreateLotInput\s*\{[\s\S]*?farmId:\s*string;[\s\S]*?\}/m,
    );
  });

  it("LotSnapshot exposes farmName + memberId + displayName; NO name/barnNumber/farmId", () => {
    const src = readSrc();
    expect(src).toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?farmName:\s*string;[\s\S]*?displayName:\s*string;[\s\S]*?memberId:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?\bname:\s*string;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?\bbarnNumber:\s*number;[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface LotSnapshot\s*\{[\s\S]*?farmId:\s*string;[\s\S]*?\}/m,
    );
  });

  it("Lot.update accepts farmName? only (post simplify-lot-identifier: name/barnNumber removed from UpdateLotInput)", () => {
    const src = readSrc();
    expect(src).toMatch(/farmName\?:\s*string;/);
    expect(src).not.toMatch(
      /export interface UpdateLotInput\s*\{[\s\S]*?\bname\?:[\s\S]*?\}/m,
    );
    expect(src).not.toMatch(
      /export interface UpdateLotInput\s*\{[\s\S]*?\bbarnNumber\?:[\s\S]*?\}/m,
    );
  });
});
