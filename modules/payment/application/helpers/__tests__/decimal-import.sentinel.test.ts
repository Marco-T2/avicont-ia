/**
 * Sentinel: import-shape — modules/payment/application/helpers/fetch-shortcut-source.
 *
 * DEC-1 enforcement for the new shortcut helper (SDD change
 * register-payment-shortcut, Phase 2 / T-09). Guards two invariants on the
 * source file at modules/payment/application/helpers/fetch-shortcut-source.ts:
 *
 *   1. NO value-import of `Prisma` from `@/generated/prisma/client`. The
 *      Prisma client namespace value pulls in `node:module` via Turbopack
 *      16.2.1's CJS interop path and contaminates the client bundle; even
 *      though this helper is server-only, the rule is enforced uniformly
 *      across application-layer modules. `import type { Prisma }` is allowed
 *      (erased at compile time) but the helper has no need for it.
 *   2. DOES default-import `Decimal` from `decimal.js@10.6.0`. The helper
 *      converts Prisma.Decimal-shaped balance values to decimal.js Decimal
 *      at the persistence boundary; the chosen import style is the default
 *      export (per decimal.d.ts: `export default Decimal`).
 *
 * Sister sentinel: modules/shared/domain/value-objects/__tests__/decimal-import.sentinel.test.ts
 * (Cycle 1 of oleada-money-decimal-hex-purity). Same regex shape.
 *
 * Declared failure mode (pre-helper-creation): assertion 1 vacuously passes,
 * assertion 2 fails. With the helper in place from T-01..T-08, both pass.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

const TARGETS = [
  "modules/payment/application/helpers/fetch-shortcut-source.ts",
] as const;

describe("sentinel: import-shape — payment/application/helpers/fetch-shortcut-source (DEC-1)", () => {
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
