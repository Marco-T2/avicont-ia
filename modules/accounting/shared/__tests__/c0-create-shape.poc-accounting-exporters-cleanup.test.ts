import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Shared namespace create-shape tests for poc-accounting-exporters-cleanup
 * (OLEADA 6 sub-POC 6/8). NEW shape — no paired sister (shared-extraction).
 *
 * Strategy: existsSync / readFileSync inside each it() block — shared files do NOT
 * exist pre-GREEN. See [[red_acceptance_failure_mode]] — expected failure mode is
 * ENOENT for positive assertions (α1..α3, α9..α10); CONDITIONAL-PASS for NEGATIVE
 * `.not.toMatch` assertions on the absent money.utils file (α4..α8 — readFileSync
 * throws before the assertion runs, so the test errors rather than passing... no:
 * the helper readMoneyUtils throws ENOENT → those it() blocks FAIL pre-GREEN too?).
 * Declared mode: positive existence/content assertions FAIL with ENOENT; the
 * NEGATIVE block (α4..α8) is wrapped so that an absent file is treated as
 * CONDITIONAL-PASS — the dep-direction guarantee trivially holds when the file
 * does not yet exist. See helper readMoneyUtilsOrEmpty below.
 *
 * Blocks (10α):
 * - Block 1 (α1..α8, EX-D1/EX-D2): shared/domain/money.utils.ts canonical home
 *   - α1..α3: file exists + sumDecimals + eq exported (FAIL pre-GREEN — ENOENT)
 *   - α4..α8: money.utils does NOT import from TB/ES/WS/IB/FS (CONDITIONAL-PASS
 *     pre-GREEN — file absent → empty content → .not.toMatch trivially holds)
 * - Block 2 (α9..α10, EX-D4): shared/infrastructure/exporters pdf placement
 *   - α9..α10: pdf.fonts.ts + pdf.helpers.ts exist (FAIL pre-GREEN AND post-C0-GREEN
 *     — git mv deferred to C1; α9..α10 flip GREEN only at C1)
 *
 * Ledger per [[enumerated_baseline_failure_ledger]]:
 * - Pre-GREEN: α1..α3, α9..α10 = 5 FAIL (ENOENT); α4..α8 = 5 CONDITIONAL-PASS
 * - Post-C0-GREEN: α1..α8 = 8 PASS; α9..α10 = 2 FAIL (pdf placement deferred to C1)
 *
 * Cross-refs: spec #2360, design #2358, proposal #2357, tasks #2361.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const SHARED_DOMAIN = path.join(ROOT, "modules/accounting/shared/domain");
const SHARED_INFRA_EXPORTERS = path.join(
  ROOT,
  "modules/accounting/shared/infrastructure/exporters",
);

const MONEY_UTILS = path.join(SHARED_DOMAIN, "money.utils.ts");

/** Positive-assertion read — throws ENOENT pre-GREEN (declared FAIL mode). */
const readMoneyUtils = (): string => readFileSync(MONEY_UTILS, "utf-8");

/**
 * NEGATIVE-assertion read — returns "" when the file is absent so the
 * dep-direction `.not.toMatch` guarantees trivially hold pre-GREEN
 * (CONDITIONAL-PASS, declared mode [[red_acceptance_failure_mode]]).
 */
const readMoneyUtilsOrEmpty = (): string =>
  existsSync(MONEY_UTILS) ? readFileSync(MONEY_UTILS, "utf-8") : "";

describe("C0 — shared/domain/money.utils.ts canonical home (EX-D1/EX-D2)", () => {
  it("α1: shared/domain/money.utils.ts exists", () => {
    expect(existsSync(MONEY_UTILS)).toBe(true);
  });

  it("α2: sumDecimals exported as a function", () => {
    expect(readMoneyUtils()).toMatch(/export\s+function\s+sumDecimals/m);
  });

  it("α3: eq exported as a function", () => {
    expect(readMoneyUtils()).toMatch(/export\s+function\s+eq/m);
  });

  it("α4: money.utils does NOT import from trial-balance (EX-D2)", () => {
    expect(readMoneyUtilsOrEmpty()).not.toMatch(
      /from\s+["']@\/modules\/accounting\/trial-balance/m,
    );
  });

  it("α5: money.utils does NOT import from equity-statement (EX-D2)", () => {
    expect(readMoneyUtilsOrEmpty()).not.toMatch(
      /from\s+["']@\/modules\/accounting\/equity-statement/m,
    );
  });

  it("α6: money.utils does NOT import from worksheet (EX-D2)", () => {
    expect(readMoneyUtilsOrEmpty()).not.toMatch(
      /from\s+["']@\/modules\/accounting\/worksheet/m,
    );
  });

  it("α7: money.utils does NOT import from initial-balance (EX-D2)", () => {
    expect(readMoneyUtilsOrEmpty()).not.toMatch(
      /from\s+["']@\/modules\/accounting\/initial-balance/m,
    );
  });

  it("α8: money.utils does NOT import from financial-statements (EX-D2)", () => {
    expect(readMoneyUtilsOrEmpty()).not.toMatch(
      /from\s+["']@\/modules\/accounting\/financial-statements/m,
    );
  });
});

describe("C0 — shared/infrastructure/exporters pdf placement (EX-D4, RED until C1)", () => {
  it("α9: shared/infrastructure/exporters/pdf.fonts.ts exists", () => {
    expect(existsSync(path.join(SHARED_INFRA_EXPORTERS, "pdf.fonts.ts"))).toBe(
      true,
    );
  });

  it("α10: shared/infrastructure/exporters/pdf.helpers.ts exists", () => {
    expect(existsSync(path.join(SHARED_INFRA_EXPORTERS, "pdf.helpers.ts"))).toBe(
      true,
    );
  });
});
