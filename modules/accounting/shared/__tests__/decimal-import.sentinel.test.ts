/**
 * Sentinel: decimal.js import-shape — sub-POC 1 unblock-bundle Cycle 2
 * (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of `modules/shared/domain/value-objects/__tests__/decimal-import.sentinel.test.ts`
 * (Cycle 1). This sentinel covers the second wave of the Turbopack bundle leak
 * fix: the shared accounting money utilities + the three journal-entry client
 * components that import `Prisma` as a VALUE to construct `Prisma.Decimal`.
 *
 * Asserts these 4 files no longer value-import `Prisma` from
 * `@/generated/prisma/client` (closing the import-graph path that pulls
 * `node:module` into the Turbopack 16.2.1 client bundle on
 * `/accounting/journal/[entryId]` and sister routes) and instead value-import
 * `Decimal` directly from `decimal.js@10.6.0`.
 *
 * Note on regex: matches VALUE-imports only. `import type { Prisma } from ...`
 * is erased at compile time and does NOT contribute to the runtime bundle —
 * out of scope for this sentinel. (None of the 4 files in scope have a type-only
 * Prisma import at the time of writing, but the regex is line-anchored to the
 * value-import form `^import\s*\{...\}\s*from\s*"@/generated/prisma/client"`.)
 *
 * Declared failure mode (pre-GREEN): all 8 assertions FAIL — every target file
 * still has `import { Prisma } from "@/generated/prisma/client"` and none import
 * from `decimal.js` yet.
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
  "modules/accounting/shared/domain/money.utils.ts",
  "components/accounting/journal-entry-detail.tsx",
  "components/accounting/journal-entry-form.tsx",
  "components/accounting/create-journal-entry-form.tsx",
] as const;

describe("sentinel: decimal.js import-shape — accounting/shared money.utils + client components (sub-POC 1 Cycle 2)", () => {
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
