/**
 * Sentinel: decimal.js import-shape — purchases/[purchaseId]/route (DEC-1 residual P1).
 *
 * Mirror exact of modules/iva-books/__tests__/decimal-import.sentinel.test.ts
 * (sub-POC 5 Cycle 1) and sister `app/api/.../sales/[saleId]/__tests__/` (commit
 * 2d8df1c2). Asserts route.ts no longer value-imports `Prisma` from
 * `@/generated/prisma/client` and instead default-imports `Decimal` from
 * `decimal.js@10.6.0`.
 *
 * Scope: route.ts uses Prisma value-form ONLY in `computeNewTotal()` helper
 * (line 98 pre-GREEN: `roundHalfUp(new Prisma.Decimal(qty).mul(unitPrice))`),
 * pure value-use, no Prisma TYPES. Standard swap (drop Prisma entirely, add
 * decimal.js), per DEC-1 canonical rule (faf26bca).
 *
 * Declared failure mode (pre-GREEN): both assertions FAIL — route.ts has
 * value-form `import { Prisma } from "@/generated/prisma/client"` (line 1)
 * and lacks decimal.js import.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../../../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts",
] as const;

describe("sentinel: decimal.js import-shape — purchases/[purchaseId]/route (DEC-1 residual P1 cycle 2)", () => {
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
