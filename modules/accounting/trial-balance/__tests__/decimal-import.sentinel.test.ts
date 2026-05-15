/**
 * Sentinel: decimal.js import-shape — sub-POC 2 domain-accounting-sub-modules
 * Cycle 2 / TB (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of sub-POC 2 Cycle 1 (FS) and sub-POC 1 sentinels. Asserts
 * `modules/accounting/trial-balance/domain/trial-balance.builder.ts` no longer
 * value-imports `Prisma` from `@/generated/prisma/client` and instead
 * default-imports `Decimal` from `decimal.js@10.6.0`.
 *
 * Note on regex: matches VALUE-imports only. `import type { Prisma } from ...`
 * is erased at compile time and does NOT contribute to the runtime bundle.
 *
 * Declared failure mode (pre-GREEN): both assertions FAIL — trial-balance.builder.ts
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
  "modules/accounting/trial-balance/domain/trial-balance.builder.ts",
] as const;

describe("sentinel: decimal.js import-shape — trial-balance/domain/trial-balance.builder (sub-POC 2 Cycle 2)", () => {
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
