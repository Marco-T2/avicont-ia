/**
 * T4.1a + T4.1b combined — REQ-DISPLAY-2 wholesale helper retirement.
 *
 * T4.1a — helper files DELETED:
 *   - modules/accounting/domain/correlative.utils.ts
 *   - features/accounting/correlative.utils.ts (re-export shim)
 *   - features/accounting/__tests__/correlative.utils.test.ts (unit tests)
 *   - features/accounting/server.ts barrel drops
 *     `export * from "./correlative.utils"`
 *
 * T4.1b — α-sentinel BLOCKS DELETED per [[named_rule_immutability]]
 *   (α-rules are IMMUTABLE; retirement = delete it() blocks, NEVER mutate
 *    regex):
 *   - poc-utils-to-hex-shape.test.ts: α02 + α06 + α11 + α17 it() blocks
 *   - poc-journal-ledger-core-hex-shape.test.ts: α35 third it() block
 *     (formatCorrelativeNumber barrel-import assertion) + α27 retention
 *     line for correlative.utils
 *
 * Derivative rule cited per [[canonical_rule_application_commit_body]]:
 *   REQ-DISPLAY-2 (zero `formatCorrelativeNumber` consumers in production)
 *   SUPERSEDES the former invariants that
 *     - correlative.utils.ts must exist
 *     - it must export formatCorrelativeNumber
 *     - features barrel must re-export it
 *     - agent/route.ts must import it from the barrel.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   all 8 below FAIL today.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

describe("T4.1 — formatCorrelativeNumber wholesale retirement (REQ-DISPLAY-2)", () => {
  it("modules/accounting/domain/correlative.utils.ts does NOT exist", () => {
    expect(
      existsSync(resolve(ROOT, "modules/accounting/domain/correlative.utils.ts")),
    ).toBe(false);
  });
  it("features/accounting/correlative.utils.ts does NOT exist", () => {
    expect(
      existsSync(resolve(ROOT, "features/accounting/correlative.utils.ts")),
    ).toBe(false);
  });
  it("features/accounting/__tests__/correlative.utils.test.ts does NOT exist", () => {
    expect(
      existsSync(
        resolve(ROOT, "features/accounting/__tests__/correlative.utils.test.ts"),
      ),
    ).toBe(false);
  });
  it("features/accounting/server.ts does NOT re-export ./correlative.utils", () => {
    const src = readFileSync(resolve(ROOT, "features/accounting/server.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']\.\/correlative\.utils["']/);
  });

  it("poc-utils-to-hex-shape.test.ts: α02 + α06 + α11 + α17 blocks deleted", () => {
    const src = readFileSync(
      resolve(
        ROOT,
        "modules/accounting/presentation/__tests__/poc-utils-to-hex-shape.test.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/it\(\s*["']α02:/);
    expect(src).not.toMatch(/it\(\s*["']α06:/);
    expect(src).not.toMatch(/it\(\s*["']α11:/);
    expect(src).not.toMatch(/it\(\s*["']α17:/);
  });

  it("poc-journal-ledger-core-hex-shape.test.ts: α35 third it (formatCorrelativeNumber barrel-import) deleted", () => {
    const src = readFileSync(
      resolve(
        ROOT,
        "modules/accounting/presentation/__tests__/poc-journal-ledger-core-hex-shape.test.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(
      /α35: agent\/route\.ts imports parseEntryDate \+ formatCorrelativeNumber/,
    );
  });

  it("poc-journal-ledger-core-hex-shape.test.ts: α27 retention assertion for correlative.utils deleted", () => {
    const src = readFileSync(
      resolve(
        ROOT,
        "modules/accounting/presentation/__tests__/poc-journal-ledger-core-hex-shape.test.ts",
      ),
      "utf8",
    );
    // The α27 retention assertion line `expect(src).toMatch(/from\s+["']\.\/correlative\.utils["']/);`
    // must be absent. Strip via line-bound regex (avoid colliding with the
    // commentary above which mentions `correlative.utils` in prose).
    expect(src).not.toMatch(/toMatch\(\/from\\\s\+\[["']\\.\\\/correlative\\.utils\[["']\/\)/);
  });
});
