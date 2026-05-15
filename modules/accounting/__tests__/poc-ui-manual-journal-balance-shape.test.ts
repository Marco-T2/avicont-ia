/**
 * α-ui-balance-* sentinels — source-text discriminators for
 * `poc-ui-manual-journal-balance` (OLEADA 8 POC #4 — last).
 *
 * Per [[red_acceptance_failure_mode]] + [[sentinel_regex_line_bound]]:
 * disciplinary/coherence discharge with R-money/R-money-tier2/R-money-vo at
 * domain layer — NOT a runtime bug. Sentinels read source text and assert
 * (A) barrel import presence, (B) `Math.round(*100) ===` ABSENCE — the
 * discriminator for UI balance-check discharge.
 *
 * Mirrors `poc-tier2-money-shape.test.ts` (OLEADA 8 POC #1) shape verbatim
 * per [[paired_sister_default_no_surface]].
 *
 * Cross-cutting accounting/UI location: sentinel file lives under
 * `modules/accounting/__tests__/` (sister precedent — POC #1 spans
 * sale/purchase/dispatch/routes, this POC spans 3 UI components).
 *
 * R-money textual reference: OLEADA 7 archive — R-money family discharged
 * via coherence (no new named rule per [[textual_rule_verification]] N/A).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

const FILES = [
  "components/accounting/journal-entry-form.tsx",
  "components/accounting/create-journal-entry-form.tsx",
  "components/accounting/journal-entry-detail.tsx",
];

describe("α-ui-balance-01 — components/accounting/journal-entry-* import eq+sumDecimals via presentation barrel", () => {
  for (const rel of FILES) {
    it(`α-ui-balance-01: ${rel} imports {eq, sumDecimals} from @/modules/accounting/presentation`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).toMatch(
        /^import[^;]+\beq\b[^;]+\bsumDecimals\b[^;]+["'][^"']*modules\/accounting\/presentation["']/m,
      );
    });
  }
});

describe("α-ui-balance-02 — components/accounting/journal-entry-* NO float cents-comparison", () => {
  for (const rel of FILES) {
    it(`α-ui-balance-02: ${rel} — NO Math.round(*100) === Math.round(*100)`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).not.toMatch(/Math\.round\([^\n]*\*\s*100\)\s*===\s*Math\.round/);
    });
  }
});
