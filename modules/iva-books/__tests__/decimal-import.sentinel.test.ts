/**
 * Sentinel: decimal.js import-shape — sub-POC 5 iva-books-harmonization
 * Cycle 1 (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of sub-POCs 2/3/4 sentinels. Asserts `legacy-bridge-constants.ts`
 * no longer value-imports `Prisma` from `@/generated/prisma/client` and
 * instead default-imports `Decimal` from `decimal.js@10.6.0`.
 *
 * Note on scope: this file holds ONLY the `TASA_IVA = new Prisma.Decimal("0.1300")`
 * constant — pure value-use, no Prisma TYPES. Standard swap (drop Prisma
 * entirely, add decimal.js), mirroring sub-POC 2 builder migrations and
 * sub-POC 4 Cycle 1 ledger.service. NOT the MIXED case shape (sub-POC 3
 * ai-agent or sub-POC 4 auto-entry-generator).
 *
 * Cycles 2+3 (modal harmonizations) get their own sentinel under
 * `components/iva-books/__tests__/` because the modal files live in a
 * different tree and use a different test runtime (jsdom for tsx).
 *
 * Declared failure mode (pre-GREEN): both assertions FAIL on
 * `legacy-bridge-constants.ts` — file currently has value-form
 * `import { Prisma } from "@/generated/prisma/client"` and lacks decimal.js
 * import.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "modules/iva-books/presentation/legacy-bridge-constants.ts",
] as const;

describe("sentinel: decimal.js import-shape — iva-books/presentation (sub-POC 5 Cycle 1)", () => {
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
