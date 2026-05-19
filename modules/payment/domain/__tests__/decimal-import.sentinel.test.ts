/**
 * Sentinel: import-shape — modules/payment/domain/payment-glosa-builder.
 *
 * REQ-GE-7 Scenario 7.3 + DEC-1 / design D11: the glosa builder is a pure
 * domain function that consumes already-converted `number` values. It MUST NOT
 * value-import `Prisma` (drags `node:module` via Turbopack 16.2.1 CJS interop)
 * NOR default-import `Decimal` from `decimal.js` (no math performed here).
 *
 * Sister sentinel: modules/sale/__tests__/decimal-import.sentinel.test.ts
 * (sale-glosa-builder.ts target). Same regex shape, both target builders.
 *
 * Declared failure mode (pre-builder-creation): module-not-found — RED.
 * Post-T-17 GREEN: both invariants pass.
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
  "modules/payment/domain/payment-glosa-builder.ts",
] as const;

describe("sentinel: import-shape — payment/domain/payment-glosa-builder (DEC-1 / REQ-GE-7)", () => {
  for (const target of TARGETS) {
    it(`${target} does NOT value-import Prisma from @/generated/prisma/client`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
    });

    it(`${target} does NOT default-import Decimal from decimal.js (builder does no math)`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(DECIMAL_DEFAULT_IMPORT_RE);
    });
  }
});
