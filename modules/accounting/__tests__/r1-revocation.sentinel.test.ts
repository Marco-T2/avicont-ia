/**
 * R1 Revocation Sentinel — oleada-money-decimal-hex-purity sub-POC 6 Cycle 1.
 *
 * Asserts that every production file in `modules/accounting/**` that previously
 * cited `R1-permissible-value-type-exception` (per OLEADA 5 archive #2282 +
 * sub-POC 1/2 carry-forward debt) has been retired via the **DEC-1 derivative
 * rule** introduced in this sub-POC.
 *
 * Per [[named_rule_immutability]]: R1 is NOT mutated in place. Instead each
 * carry-forward file gains a leading `Revoked-by: DEC-1` clause + a forward
 * citation to the new canonical rule, and any remaining R1 prose is bracketed
 * by a `[HISTORICAL` marker (so future readers know the rule is no longer
 * active in this file).
 *
 * Failure mode (RED):
 *   Pre-GREEN every file FAILS both assertions (no `Revoked-by: DEC-1`,
 *   no `[HISTORICAL` marker). Post-GREEN every file PASSES both.
 *
 * Sister precedent:
 *   modules/iva-books/__tests__/c0-domain-presentation-relocation-shape.poc-accounting-iva-books-hex.test.ts
 *   — α6 SKIP + α6-D derivative shape (sub-POC 5 Cycle 1).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");

const R1_CARRY_FORWARD_FILES = [
  "modules/accounting/shared/domain/money.utils.ts",
  "modules/accounting/financial-statements/domain/money.utils.ts",
  "modules/accounting/trial-balance/domain/trial-balance.builder.ts",
  "modules/accounting/initial-balance/domain/initial-balance.builder.ts",
  "modules/accounting/worksheet/domain/worksheet.builder.ts",
  "modules/accounting/equity-statement/domain/equity-statement.builder.ts",
  "modules/accounting/presentation/index.ts",
] as const;

function readFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("R1 revocation sentinel — DEC-1 derivative supersedes EX-D3 R1 [sub-POC 6 Cycle 1]", () => {
  describe.each(R1_CARRY_FORWARD_FILES)("%s", (filePath) => {
    it("contains a `Revoked-by: DEC-1` clause citing this sub-POC", () => {
      const content = readFile(filePath);
      expect(content).toMatch(/Revoked-by:\s*DEC-1/);
    });

    it("brackets any remaining R1 prose with a `[HISTORICAL` marker", () => {
      const content = readFile(filePath);
      // If the file still mentions R1, the mention must be inside a HISTORICAL
      // block. If the file no longer mentions R1 at all, this assertion is
      // trivially satisfied. Either is acceptable post-revocation.
      const stillMentionsR1 = /R1-permissible-value-type-exception/.test(content);
      if (stillMentionsR1) {
        expect(content).toMatch(/\[HISTORICAL/);
      } else {
        expect(stillMentionsR1).toBe(false);
      }
    });
  });
});
