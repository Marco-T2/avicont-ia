/**
 * Sentinel: decimal.js import-shape + Math.round eradication —
 * iva-books modals (sub-POC 5 Cycles 2+3 of oleada-money-decimal-hex-purity).
 *
 * Behavioral sister: the iva-books modals currently use `Math.round(n * factor) / factor`
 * float-cents arithmetic — exactly the anti-policy pattern Money/Decimal
 * was designed to eliminate. This sentinel cements the harmonization to
 * `decimal.js@10.6.0` ROUND_HALF_UP. Companion parity tables
 * (`iva-book-{purchase,sale}-modal-parity.test.ts`) anchor BIT-PERFECT
 * behavioral preservation across ≥13 SIN-canonical IVA 13% Bolivia cases.
 *
 * The grep targets:
 *  - DECIMAL_DEFAULT_IMPORT_RE: requires `import Decimal from "decimal.js"`
 *  - MATH_ROUND_FLOATCENTS_RE: forbids `Math.round(<anything>* <anything>)`
 *    — the float-cents pattern (multiply-then-round). Plain `Math.round(x)`
 *    on a single argument is NOT flagged (no such usage in modals — verified
 *    pre-RED). Pattern uses `[^\n]*` per [[sentinel_regex_line_bound]] to
 *    avoid paren-nesting false-negatives.
 *
 * Declared failure mode (pre-GREEN per Cycle 2 RED): on `iva-book-purchase-modal.tsx`
 *  - decimal.js-import assertion: FAIL (no Decimal import yet)
 *  - Math.round-eradication assertion: FAIL (still uses Math.round float-cents)
 * Sister failures pre-Cycle 3 RED on `iva-book-sale-modal.tsx` likewise.
 *
 * Per [[cross_module_boundary_mock_target_rewrite]] / sub-POC 4 ai-agent
 * MIXED-case precedent: this sentinel targets BOTH modals from RED Cycle 2
 * onward. Cycle 2 GREEN closes the purchase modal; Cycle 3 GREEN closes
 * the sale modal. Between GREEN-2 and RED-3, the sale-modal assertions
 * remain FAILing — that is the declared transitional shape.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const MATH_ROUND_FLOATCENTS_RE =
  /Math\.round\([^\n]*\*[^\n]*\)/;

const TARGETS = [
  "components/iva-books/iva-book-purchase-modal.tsx",
  "components/iva-books/iva-book-sale-modal.tsx",
] as const;

describe("sentinel: decimal.js + no-Math.round — iva-books modals (sub-POC 5 Cycles 2+3)", () => {
  for (const target of TARGETS) {
    it(`${target} default-imports Decimal from decimal.js`, () => {
      const src = readRepo(target);
      expect(src).toMatch(DECIMAL_DEFAULT_IMPORT_RE);
    });

    it(`${target} does NOT use Math.round float-cents arithmetic`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(MATH_ROUND_FLOATCENTS_RE);
    });
  }
});
