/**
 * Sentinel: decimal.js import-shape — iva-books/sales/export/entity-to-dto (DEC-1 residual P2).
 *
 * Mirror exact of app/api/organizations/[orgSlug]/sales/[saleId]/__tests__/decimal-import.sentinel.test.ts
 * (sub-POC 6 P1 precedent, commit 2d8df1c2). Asserts entity-to-dto.ts no longer
 * value-imports `Prisma` from `@/generated/prisma/client` and instead
 * default-imports `Decimal` from `decimal.js@10.6.0`.
 *
 * Scope: entity-to-dto.ts uses Prisma value-form in `D()` constructor helper
 * (pre-GREEN: `const D = (n: number): Prisma.Decimal => new Prisma.Decimal(n)`),
 * pure value-use. Standard swap (drop Prisma entirely, add decimal.js), per
 * DEC-1 canonical rule (faf26bca).
 *
 * Declared failure mode (pre-GREEN): both assertions FAIL — entity-to-dto.ts has
 * value-form `import { Prisma } from "@/generated/prisma/client"` (line 5) and
 * lacks decimal.js import.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../../../../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "app/api/organizations/[orgSlug]/iva-books/sales/export/entity-to-dto.ts",
] as const;

describe("sentinel: decimal.js import-shape — iva-books/sales/export/entity-to-dto (DEC-1 residual P2)", () => {
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
