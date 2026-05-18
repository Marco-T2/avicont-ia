/**
 * T2.4-page — REQ-DISPLAY-2 sentinel: sales/[saleId]/page.tsx + its
 * co-located page-rbac mock factory MUST NOT reference the retired
 * display-code helpers.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   - page.tsx imports `computeDisplayCode, SALE_PREFIX` (L12-13) +
 *     invokes them at L101-104 → grep MUST be ZERO; FAILS today.
 *   - page-rbac.test.ts mock factory L50-54 stubs `SALE_PREFIX` +
 *     `computeDisplayCode` → grep MUST be ZERO; FAILS today.
 *
 * GREEN: drop both helper imports + the entire `displayCode:` field from
 *   `toSaleWithDetails(...)` deps + drop §13.AC JSDoc block from page;
 *   drop the two stub keys from the mock factory.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..");
const PAGE = resolve(ROOT, "app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx");
const RBAC = resolve(
  ROOT,
  "app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts",
);

describe("T2.4-page — sales/[saleId] helper retirement (REQ-DISPLAY-2)", () => {
  it("page.tsx does NOT import or invoke computeDisplayCode | SALE_PREFIX", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/\bcomputeDisplayCode\b/);
    expect(src).not.toMatch(/\bSALE_PREFIX\b/);
  });

  it("page-rbac.test.ts mock factory does NOT stub SALE_PREFIX | computeDisplayCode", () => {
    const src = readFileSync(RBAC, "utf8");
    expect(src).not.toMatch(/SALE_PREFIX\s*:/);
    expect(src).not.toMatch(/computeDisplayCode\s*:/);
  });
});
