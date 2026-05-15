/**
 * Sentinel: decimal.js import-shape — sub-POC 4 application-layer-cleanup
 * Cycle 1 / ledger.service (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of sub-POC 3 Cycles 1-4 (sale, purchase, dispatch, ai-agent) and
 * sub-POC 2 Cycles 1-5. Asserts
 * `modules/accounting/application/ledger.service.ts` no longer value-imports
 * `Prisma` from `@/generated/prisma/client` and instead default-imports
 * `Decimal` from `decimal.js@10.6.0`.
 *
 * Note on regex: matches VALUE-imports only. `import type { Prisma } from ...`
 * is erased at compile time and does NOT contribute to the runtime bundle.
 * (This file has no need for `import type { Prisma }` — its only Prisma
 * usage is `Prisma.Decimal` value, fully replaceable by top-level decimal.js
 * Decimal. The `AccountType` type continues to be imported separately from
 * `@/generated/prisma/client` as a type-only import, unaffected.)
 *
 * Declared failure mode (pre-GREEN): both assertions FAIL — ledger.service.ts
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

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "modules/accounting/application/ledger.service.ts",
] as const;

describe("sentinel: decimal.js import-shape — accounting/application/ledger.service (sub-POC 4 Cycle 1)", () => {
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
