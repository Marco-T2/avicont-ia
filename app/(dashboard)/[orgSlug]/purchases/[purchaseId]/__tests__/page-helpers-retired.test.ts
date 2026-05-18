/**
 * T2.5-page — REQ-DISPLAY-2 sentinel: purchases/[purchaseId]/page.tsx +
 * its co-located page-rbac mock factory MUST NOT reference the retired
 * display-code helpers.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   - page.tsx imports `computeDisplayCode, TYPE_PREFIXES` (L13-14) +
 *     invokes them at L108-111 → grep MUST be ZERO; FAILS today.
 *   - page-rbac.test.ts mock factory L55-67 stubs `TYPE_PREFIXES` +
 *     `computeDisplayCode` → grep MUST be ZERO; FAILS today.
 *
 * GREEN: drop both helper imports + the entire `displayCode:` field from
 *   `toPurchaseWithDetails(...)` deps + drop §13.AC-purchase JSDoc block
 *   from page; drop the TYPE_PREFIXES object + computeDisplayCode stub
 *   from the mock factory.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..");
const PAGE = resolve(
  ROOT,
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
);
const RBAC = resolve(
  ROOT,
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts",
);

describe("T2.5-page — purchases/[purchaseId] helper retirement (REQ-DISPLAY-2)", () => {
  it("page.tsx does NOT import or invoke computeDisplayCode | TYPE_PREFIXES", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/\bcomputeDisplayCode\b/);
    expect(src).not.toMatch(/\bTYPE_PREFIXES\b/);
  });

  it("page-rbac.test.ts mock factory does NOT stub TYPE_PREFIXES | computeDisplayCode", () => {
    const src = readFileSync(RBAC, "utf8");
    expect(src).not.toMatch(/TYPE_PREFIXES\s*:/);
    expect(src).not.toMatch(/computeDisplayCode\s*:/);
  });
});
