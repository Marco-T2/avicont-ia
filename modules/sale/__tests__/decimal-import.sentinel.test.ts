/**
 * Sentinel: import-shape — sale/domain/build-sale-entry-lines.
 *
 * Post lcv-feature-retirement: IVA path removed. Decimal import no longer
 * needed (pure number arithmetic). Guards that:
 * 1. Prisma runtime value-import is absent (still enforced).
 * 2. Decimal default-import is absent (IVA path retired — RND 102100000011).
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
  "modules/sale/domain/build-sale-entry-lines.ts",
  // REQ-GE-7 Scenario 7.3 (DEC-1): glosa builder must NOT value-import Prisma
  // nor default-import Decimal — it consumes already-converted `number`.
  "modules/sale/domain/sale-glosa-builder.ts",
] as const;

describe("sentinel: import-shape — sale/domain/build-sale-entry-lines (post-lcv-retirement)", () => {
  for (const target of TARGETS) {
    it(`${target} does NOT value-import Prisma from @/generated/prisma/client`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
    });

    it(`${target} does NOT default-import Decimal from decimal.js (IVA path retired)`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(DECIMAL_DEFAULT_IMPORT_RE);
    });
  }
});
