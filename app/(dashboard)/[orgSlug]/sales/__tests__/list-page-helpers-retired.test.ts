/**
 * T2.0 — REQ-DISPLAY-2 sentinel: list pages
 * `app/(dashboard)/[orgSlug]/sales/page.tsx` and
 * `app/(dashboard)/[orgSlug]/purchases/page.tsx` MUST NOT import or invoke
 * the retired display-code helpers (`computeDisplayCode`, `SALE_PREFIX`,
 * `TYPE_PREFIXES`).
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   `expect(salesSrc).not.toMatch(/computeDisplayCode|SALE_PREFIX/)` FAILS at
 *   sales/page.tsx L7-9 (imports) + L131-134 (invocation); the analogous
 *   purchases assertion FAILS at purchases/page.tsx L7-9 + L98-101.
 *
 * GREEN: drop helper imports + the `displayCode:` field from the deps object
 *   in both `toSaleWithDetails(...)` / `toPurchaseWithDetails(...)` calls;
 *   drop the JSDoc invariant block citing `§13.AC`. Mapper interface/DTO
 *   field becomes optional (final wholesale-delete deferred to T4.2/T4.3).
 *
 * Also asserts `transactionRows[*].displayCode = String(sequenceNumber)`
 * literal pattern remains intact (out of scope per proposal —
 * TransactionsList prop receives raw sequence number).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");

const SALES_PAGE = resolve(ROOT, "app/(dashboard)/[orgSlug]/sales/page.tsx");
const PURCHASES_PAGE = resolve(
  ROOT,
  "app/(dashboard)/[orgSlug]/purchases/page.tsx",
);

describe("T2.0 — list pages display-code helper retirement (REQ-DISPLAY-2)", () => {
  it("sales/page.tsx does NOT import or invoke computeDisplayCode | SALE_PREFIX", () => {
    const src = readFileSync(SALES_PAGE, "utf8");
    expect(src).not.toMatch(/\bcomputeDisplayCode\b/);
    expect(src).not.toMatch(/\bSALE_PREFIX\b/);
  });

  it("purchases/page.tsx does NOT import or invoke computeDisplayCode | TYPE_PREFIXES", () => {
    const src = readFileSync(PURCHASES_PAGE, "utf8");
    expect(src).not.toMatch(/\bcomputeDisplayCode\b/);
    expect(src).not.toMatch(/\bTYPE_PREFIXES\b/);
  });

  it("sales/page.tsx transactionRows mapping still emits String(sequenceNumber) (out-of-scope cosmetic)", () => {
    const src = readFileSync(SALES_PAGE, "utf8");
    expect(src).toMatch(/displayCode:\s*s\.sequenceNumber\s*!==\s*null\s*\?\s*String\(s\.sequenceNumber\)/);
    expect(src).toMatch(/displayCode:\s*d\.sequenceNumber\s*!==\s*null\s*\?\s*String\(d\.sequenceNumber\)/);
  });
});
