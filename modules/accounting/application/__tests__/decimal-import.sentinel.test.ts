/**
 * Sentinel: decimal.js import-shape — sub-POC 4 application-layer-cleanup
 * Cycles 1+2 (sdd/oleada-money-decimal-hex-purity).
 *
 * Sister of sub-POC 3 Cycles 1-4 (sale, purchase, dispatch, ai-agent) and
 * sub-POC 2 Cycles 1-5. Asserts both application-layer files no longer
 * value-import `Prisma` from `@/generated/prisma/client` and instead
 * default-import `Decimal` from `decimal.js@10.6.0`.
 *
 * Note on regex: matches VALUE-imports only. `import type { Prisma } from ...`
 * is erased at compile time and does NOT contribute to the runtime bundle.
 *
 * Cycle 1 (ledger.service.ts) — GREEN at 5de23dfe: no `import type { Prisma }`
 * needed (only Prisma surface was `Prisma.Decimal` value; `AccountType` is
 * a separate type-only import).
 *
 * Cycle 2 (auto-entry-generator.ts) — MIXED: file uses `Prisma.TransactionClient`
 * TYPE in `generate(tx, ...)` parameter, so MUST convert `import { Prisma }`
 * value-import into `import type { Prisma }` AND add `import Decimal from
 * "decimal.js"`. Type-only imports do NOT contribute to bundle and are
 * compatible with the `^import\s*\{[^}]*\bPrisma\b[^}]*\}` regex when they
 * include the `type` modifier (the regex uses negative lookbehind via NOT
 * matching value-import shape — we keep the regex VALUE-only by anchoring
 * the literal `import {` without `type`, mirroring sub-POC 3 ai-agent
 * sentinel which faced the same MIXED case and locked the same regex
 * shape per [[red_regex_discipline]]).
 *
 * Declared failure mode for Cycle 2 (pre-GREEN): both assertions FAIL on
 * auto-entry-generator.ts — file currently has value-form
 * `import { Prisma } from "@/generated/prisma/client"` and lacks decimal.js
 * import.
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
  "modules/accounting/application/auto-entry-generator.ts",
] as const;

describe("sentinel: decimal.js import-shape — accounting/application (sub-POC 4 Cycles 1+2)", () => {
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
