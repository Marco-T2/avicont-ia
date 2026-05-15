/**
 * Sentinel: decimal.js import-shape — sub-POC 2 domain-accounting-sub-modules
 * Cycle 1 / FS stack (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of:
 *   - modules/shared/domain/value-objects/__tests__/decimal-import.sentinel.test.ts
 *     (sub-POC 1 Cycle 1 — shared/domain VOs)
 *   - modules/accounting/shared/__tests__/decimal-import.sentinel.test.ts
 *     (sub-POC 1 Cycle 2 — accounting/shared + journal-entry clients)
 *
 * Asserts that `modules/accounting/financial-statements/domain/money.utils.ts`
 * no longer value-imports `Prisma` from `@/generated/prisma/client` and instead
 * default-imports `Decimal` from `decimal.js@10.6.0`. money.utils.ts is the
 * single domain file in financial-statements that runtime-touched
 * `Prisma.Decimal` (R1-permissible exception locked OLEADA 5 #2282) — the two
 * FS builder files (`income-statement.builder.ts`, `balance-sheet.builder.ts`)
 * are pure consumers of `money.utils` helpers and never had a Prisma
 * value-import, so they are NOT covered here.
 *
 * Note on regex: matches VALUE-imports only. `import type { Prisma } from ...`
 * is erased at compile time and does NOT contribute to the runtime bundle —
 * out of scope for this sentinel.
 *
 * Declared failure mode (pre-GREEN): BOTH assertions FAIL — money.utils.ts
 * currently `import { Prisma } from "@/generated/prisma/client"` and does NOT
 * import from `decimal.js` yet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// Value-import regex: line-anchored, multiline. Does NOT match type-only
// imports (`import type { Prisma } from ...`).
const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

// Decimal.js default-import regex (per decimal.d.ts: `export default Decimal`).
const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "modules/accounting/financial-statements/domain/money.utils.ts",
] as const;

describe("sentinel: decimal.js import-shape — financial-statements/domain/money.utils (sub-POC 2 Cycle 1)", () => {
  for (const target of TARGETS) {
    it(`${target} does NOT value-import Prisma from @/generated/prisma/client`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
    });

    it(`${target} default-imports Decimal from decimal.js`, () => {
      const src = readRepo(target);
      expect(src).toMatch(DECIMAL_DEFAULT_IMPORT_RE);
    });
  }
});
