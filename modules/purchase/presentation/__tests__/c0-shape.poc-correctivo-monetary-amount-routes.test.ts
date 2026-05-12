/**
 * POC correctivo monetary-amount-routes — C0 RED textual gate
 * corrective POC fixing 6 build-blocking TSC2345 errors across 4 API route files
 * (purchases POST/PATCH + sales POST/PATCH). Half-finished migration left zod
 * schemas producing `lineAmount?: number | undefined` while service input types
 * upgraded to required `MonetaryAmount` class.
 *
 * Root cause: zod `.number().optional()` ↔ service input requires `MonetaryAmount`
 * (value object). Adapter at route seam was the established fix pattern
 * (iva-books precedent §7).
 *
 * Fix axis: add `M` adapter at route level (mirrors iva-books seam pattern with
 * signature divergence #7: `(v: number | undefined): MonetaryAmount` vs
 * iva-books `(v: string) => MonetaryAmount`). Map `details` array through `M`
 * before passing to service. A1 zero-fallback decision: undefined → zero().
 *
 * Paired sister: `poc-correctivo-dispatch-instantiation` (constructor-arity axis;
 * 4-commit chain). This POC: 3-commit chain (no vi.mock surface).
 *
 * 12α distribution (per spec §2 normalized table):
 *   α1-α8  — 4 files × {IMPORT POS, ADAPTER POS}
 *   α9-α12 — 4 files × WRAP POS (NEG intent — wrapping enforces no raw passthrough)
 *
 * ROOT = 4 levels up from __tests__/ dir (mirror sister dispatch corrective EXACT):
 *   modules/purchase/presentation/__tests__/ → modules/purchase/presentation/
 *   → modules/purchase/ → modules/ → (project root)
 *
 * Expected failure mode pre-GREEN (per [[red_acceptance_failure_mode]] +
 * [[enumerated_baseline_failure_ledger]]): ALL 12 FAIL at C0 commit state.
 * No PASS-locks (no mock layer).
 *
 *   α1  FAIL: purchases/route.ts has NO `^import.*MonetaryAmount.*from` line
 *   α2  FAIL: purchases/route.ts has NO `const M = (v: number | undefined)` adapter
 *   α3  FAIL: purchases/[purchaseId]/route.ts has NO MonetaryAmount import
 *   α4  FAIL: purchases/[purchaseId]/route.ts has NO `const M = (v: number | undefined)` adapter
 *   α5  FAIL: sales/route.ts has NO MonetaryAmount import
 *   α6  FAIL: sales/route.ts has NO `const M = (v: number | undefined)` adapter
 *   α7  FAIL: sales/[saleId]/route.ts has NO MonetaryAmount import
 *   α8  FAIL: sales/[saleId]/route.ts has NO `const M = (v: number | undefined)` adapter
 *   α9  FAIL: purchases/route.ts passes `input` (containing `lineAmount?: number`)
 *             to service — no `lineAmount: M(` wrapping present
 *   α10 FAIL: purchases/[purchaseId]/route.ts passes `input` to update — no `lineAmount: M(` wrap
 *   α11 FAIL: sales/route.ts passes `input` to service — no `lineAmount: M(` wrap
 *   α12 FAIL: sales/[saleId]/route.ts passes `input` to update — no `lineAmount: M(` wrap
 *
 * Post-C1 GREEN: all 12 PASS.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// IMPORT POS: MonetaryAmount import declaration present
const IMPORT_MONETARY_AMOUNT_REGEX = /^import.*MonetaryAmount.*from/m;

// ADAPTER POS: M adapter signature literal `const M = (v: number | undefined)`
const ADAPTER_SIGNATURE_REGEX = /const M = \(v: number \| undefined\)/;

// WRAP POS (NEG intent): `lineAmount: M(` enforces wrap, prevents raw passthrough
const WRAP_LINEAMOUNT_M_REGEX = /lineAmount: M\(/;

describe("POC correctivo monetary-amount-routes — C0 RED shape gate 12α", () => {
  // ── α1-α2: app/api/organizations/[orgSlug]/purchases/route.ts ────────────

  it("α1 IMPORT POS: purchases/route.ts imports MonetaryAmount", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/route.ts"),
    ).toMatch(IMPORT_MONETARY_AMOUNT_REGEX);
  });

  it("α2 ADAPTER POS: purchases/route.ts declares const M = (v: number | undefined) adapter", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/route.ts"),
    ).toMatch(ADAPTER_SIGNATURE_REGEX);
  });

  // ── α3-α4: app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts

  it("α3 IMPORT POS: purchases/[purchaseId]/route.ts imports MonetaryAmount", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts"),
    ).toMatch(IMPORT_MONETARY_AMOUNT_REGEX);
  });

  it("α4 ADAPTER POS: purchases/[purchaseId]/route.ts declares const M = (v: number | undefined) adapter", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts"),
    ).toMatch(ADAPTER_SIGNATURE_REGEX);
  });

  // ── α5-α6: app/api/organizations/[orgSlug]/sales/route.ts ────────────────

  it("α5 IMPORT POS: sales/route.ts imports MonetaryAmount", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/route.ts"),
    ).toMatch(IMPORT_MONETARY_AMOUNT_REGEX);
  });

  it("α6 ADAPTER POS: sales/route.ts declares const M = (v: number | undefined) adapter", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/route.ts"),
    ).toMatch(ADAPTER_SIGNATURE_REGEX);
  });

  // ── α7-α8: app/api/organizations/[orgSlug]/sales/[saleId]/route.ts ───────

  it("α7 IMPORT POS: sales/[saleId]/route.ts imports MonetaryAmount", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/[saleId]/route.ts"),
    ).toMatch(IMPORT_MONETARY_AMOUNT_REGEX);
  });

  it("α8 ADAPTER POS: sales/[saleId]/route.ts declares const M = (v: number | undefined) adapter", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/[saleId]/route.ts"),
    ).toMatch(ADAPTER_SIGNATURE_REGEX);
  });

  // ── α9-α12: WRAP POS (NEG intent — `lineAmount: M(` wrapping enforces no raw pass)

  it("α9 WRAP POS: purchases/route.ts wraps lineAmount via M(", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/route.ts"),
    ).toMatch(WRAP_LINEAMOUNT_M_REGEX);
  });

  it("α10 WRAP POS: purchases/[purchaseId]/route.ts wraps lineAmount via M(", () => {
    expect(
      read("app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts"),
    ).toMatch(WRAP_LINEAMOUNT_M_REGEX);
  });

  it("α11 WRAP POS: sales/route.ts wraps lineAmount via M(", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/route.ts"),
    ).toMatch(WRAP_LINEAMOUNT_M_REGEX);
  });

  it("α12 WRAP POS: sales/[saleId]/route.ts wraps lineAmount via M(", () => {
    expect(
      read("app/api/organizations/[orgSlug]/sales/[saleId]/route.ts"),
    ).toMatch(WRAP_LINEAMOUNT_M_REGEX);
  });
});
