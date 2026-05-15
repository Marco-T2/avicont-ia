/**
 * α-tier2-* sentinels — source-text discriminators for
 * `poc-tier2-money-decimal-convergence` (OLEADA 8 POC #1).
 *
 * Per [[red_acceptance_failure_mode]] + [[red_regex_discipline]] +
 * [[runtime_path_coverage_red_scope]]: behavioral parity (SHAPE-A —
 * `number` DTO contract preserved at builder boundary) means existing
 * fixture tests PASS pre+post convergence. These sentinels read source
 * text and assert (A) Decimal token import + call presence, (B)
 * `Math.round(*100)` ABSENCE — the actual discriminator for R-money-tier2
 * discharge.
 *
 * Mirrors α13c/α13d (POC #2 — TIER 1) shape verbatim per
 * [[paired_sister_default_no_surface]].
 *
 * Cross-cutting accounting location per design Q-NEW1 lock: TIER 2 spans
 * sale/purchase/dispatch/routes all feeding accounting — single
 * consolidated sentinel file matches POC #2 sigma-13 precedent.
 *
 * R-money-tier2 textual reference: derivative from R-money (OLEADA 7
 * archive #2452 — sdd/poc-money-math-decimal-convergence/archive-report)
 * per [[named_rule_immutability]].
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

// Block C1 — Sale builder Decimal convergence (S1 L59 exentos, S2 L75
// ingresoNeto, S3 L76 itAmount). Mirror α13c shape: import + call + absence.
describe("α-tier2-sale-01 — modules/sale/domain/build-sale-entry-lines.ts Decimal-converged (R-money-tier2)", () => {
  const SALE_BUILDER = resolve(
    ROOT,
    "modules/sale/domain/build-sale-entry-lines.ts",
  );

  it("α-tier2-sale-01: imports roundHalfUp from shared/domain/money.utils and calls it (R-money-tier2 DISCHARGED at S1/S2/S3)", () => {
    const src = readFileSync(SALE_BUILDER, "utf-8");
    expect(src).toMatch(
      /^import[^;]+roundHalfUp[^;]+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\broundHalfUp\s*\(/);
  });

  it("α-tier2-sale-01: NO float Math.round(*100) cents-arithmetic (R-money-tier2 scope)", () => {
    const src = readFileSync(SALE_BUILDER, "utf-8");
    expect(src).not.toMatch(/Math\.round\([^\n]*\*\s*100\)/);
  });
});

// Block C2 — Purchase builder Decimal convergence (P1 L82 exentos, P2 L96
// gastoNeto). Symmetric to α-tier2-sale-01.
describe("α-tier2-purchase-01 — modules/purchase/domain/build-purchase-entry-lines.ts Decimal-converged (R-money-tier2)", () => {
  const PURCHASE_BUILDER = resolve(
    ROOT,
    "modules/purchase/domain/build-purchase-entry-lines.ts",
  );

  it("α-tier2-purchase-01: imports roundHalfUp from shared/domain/money.utils and calls it (R-money-tier2 DISCHARGED at P1/P2)", () => {
    const src = readFileSync(PURCHASE_BUILDER, "utf-8");
    expect(src).toMatch(
      /^import[^;]+roundHalfUp[^;]+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\broundHalfUp\s*\(/);
  });

  it("α-tier2-purchase-01: NO float Math.round(*100) cents-arithmetic (R-money-tier2 scope)", () => {
    const src = readFileSync(PURCHASE_BUILDER, "utf-8");
    expect(src).not.toMatch(/Math\.round\([^\n]*\*\s*100\)/);
  });
});

// Block C3 — Dispatch domain Decimal convergence (D1 L59 BC lineAmount,
// D2 L78 ND lineAmount). `roundTotal` (round-total.ts) EXCLUDED per
// R-money-tier2 textual scope (cooperative-rounding semantic, Math.floor/ceil).
describe("α-tier2-dispatch-01 — modules/dispatch/domain/compute-line-amounts.ts Decimal-converged (R-money-tier2)", () => {
  const DISPATCH_DOMAIN = resolve(
    ROOT,
    "modules/dispatch/domain/compute-line-amounts.ts",
  );

  it("α-tier2-dispatch-01: imports roundHalfUp from shared/domain/money.utils and calls it (R-money-tier2 DISCHARGED at D1/D2)", () => {
    const src = readFileSync(DISPATCH_DOMAIN, "utf-8");
    expect(src).toMatch(
      /^import[^;]+roundHalfUp[^;]+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\broundHalfUp\s*\(/);
  });

  it("α-tier2-dispatch-01: NO float Math.round(*100) cents-arithmetic (R-money-tier2 scope; roundTotal EXCLUDED — different file)", () => {
    const src = readFileSync(DISPATCH_DOMAIN, "utf-8");
    expect(src).not.toMatch(/Math\.round\([^\n]*\*\s*100\)/);
  });
});
