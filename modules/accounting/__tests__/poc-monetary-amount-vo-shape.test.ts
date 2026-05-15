/**
 * α-vo-01 sentinel — source-text discriminator for
 * `poc-monetary-amount-vo-retirement` (OLEADA 8 POC #2).
 *
 * Per [[red_acceptance_failure_mode]] + [[red_regex_discipline]] +
 * [[runtime_path_coverage_red_scope]]: behavioral parity (SHAPE-A interno —
 * `.value: number` public boundary preserved via `.toNumber()`) means existing
 * `monetary-amount.test.ts` fixture PASSES pre+post convergence. This sentinel
 * reads source text and asserts (A) Decimal token import + call presence,
 * (B) `Math.round(*100)` ABSENCE — the actual discriminator for R-money-vo
 * discharge at VO internal arithmetic.
 *
 * Mirrors α-tier2-* (POC #1 — TIER 2) shape verbatim per
 * [[paired_sister_default_no_surface]].
 *
 * Cross-cutting accounting location per proposal Q10 lock: VO is shared/
 * but R-money-vo lives in accounting money-math axis — sentinel co-located
 * with sister sentinels under `modules/accounting/__tests__/`.
 *
 * R-money-vo textual reference: derivative from R-money (OLEADA 7
 * archive #2452 — sdd/poc-money-math-decimal-convergence/archive-report)
 * per [[named_rule_immutability]]; sister R-money-tier2 EXCLUDED clause at
 * sigma-13 L594-595 pre-names this rule.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

describe("α-vo-01 — modules/shared/domain/value-objects/monetary-amount.ts Decimal-converged (R-money-vo)", () => {
  const VO = resolve(
    ROOT,
    "modules/shared/domain/value-objects/monetary-amount.ts",
  );

  it("α-vo-01: imports roundHalfUp from shared/domain/money.utils and calls it (R-money-vo DISCHARGED at VO internal arithmetic)", () => {
    const src = readFileSync(VO, "utf-8");
    expect(src).toMatch(
      /^import[^;]+roundHalfUp[^;]+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\broundHalfUp\s*\(/);
  });

  it("α-vo-01: NO float Math.round(*100) cents-arithmetic (R-money-vo scope)", () => {
    const src = readFileSync(VO, "utf-8");
    expect(src).not.toMatch(/Math\.round\([^\n]*\*\s*100\)/);
  });
});
