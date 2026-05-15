/**
 * DEC-1 Canonical Rule Sentinel — oleada-money-decimal-hex-purity sub-POC 6 Cycle 2.
 *
 * Asserts that `modules/accounting/shared/domain/money.utils.ts` — the
 * canonical money-math home for `modules/accounting/*` — textually CEMENTS
 * the DEC-1 canonical rule that supersedes EX-D3 R1.
 *
 * Per Marco's archive directive: "decimal.js queda como fuente de verdad
 * arquitectónica desde este punto para adelante". The rule must live in
 * code (not only engram), at the natural canonical domain math file.
 *
 * Failure mode (RED):
 *   Pre-GREEN money.utils.ts has the DEC-1 derivative one-liner from Cycle 1
 *   but NOT the full 4-invariant canonical-rule block. Sentinel FAILS on both
 *   missing-phrase assertions.
 *
 * Post-GREEN both assertions PASS — the canonical block is appended after
 * the existing header.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const CANONICAL_HOME = "modules/accounting/shared/domain/money.utils.ts";

describe("DEC-1 canonical-rule cementation sentinel — money.utils.ts [sub-POC 6 Cycle 2]", () => {
  it("contains the literal phrase `CANONICAL RULE: DEC-1`", () => {
    const content = readFileSync(resolve(REPO_ROOT, CANONICAL_HOME), "utf8");
    expect(content).toMatch(/CANONICAL RULE:\s*DEC-1/);
  });

  it("contains the literal phrase `Prisma.Decimal value-form is FORBIDDEN`", () => {
    const content = readFileSync(resolve(REPO_ROOT, CANONICAL_HOME), "utf8");
    expect(content).toMatch(/Prisma\.Decimal value-form is FORBIDDEN/);
  });
});
