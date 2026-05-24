/**
 * Retirement sentinel — selectBodyFontSize dead shim.
 *
 * selectBodyFontSize was a @deprecated shim returning a constant 8 (pdf.exporter
 * uses BODY_FONT_SIZE=8 fijo). ZERO callers anywhere — verified project-scope,
 * including same-file. This sentinel locks its ABSENCE post-retirement.
 *
 * Failure mode declared (per [[red_acceptance_failure_mode]]) — pre-GREEN:
 *  fn-absent  sheet.builder.ts STILL exports selectBodyFontSize -> FAIL
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..");

describe("financial-statements selectBodyFontSize retirement", () => {
  it("fn-absent: sheet.builder.ts no longer exports selectBodyFontSize", () => {
    const src = readFileSync(
      resolve(
        ROOT,
        "modules/accounting/financial-statements/infrastructure/exporters/sheet.builder.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/\bselectBodyFontSize\b/);
  });
});
