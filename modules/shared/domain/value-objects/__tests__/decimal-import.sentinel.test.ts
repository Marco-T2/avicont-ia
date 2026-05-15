/**
 * Sentinel: decimal.js import-shape — sub-POC 1 unblock-bundle
 * (sdd/oleada-money-decimal-hex-purity).
 *
 * Asserts that the two shared monetary VOs no longer value-import `Prisma`
 * from `@/generated/prisma/client` (the import-graph leak that pulls
 * `node:module` into the Turbopack 16.2.1 client bundle), and instead
 * value-import `Decimal` directly from `decimal.js@10.6.0` (pure math, no
 * node builtins).
 *
 * Scope: this file covers Cycle 1 of sub-POC 1:
 *   - modules/shared/domain/value-objects/money.ts
 *   - modules/shared/domain/value-objects/monetary-amount.ts
 *
 * Behavioral parity is asserted by the existing tests in this directory
 * (money.test.ts, monetary-amount.test.ts) — they MUST stay green unedited
 * across the swap. This sentinel asserts only the import-shape invariant.
 *
 * Declared failure mode (pre-GREEN): all assertions FAIL because both files
 * currently contain `import { Prisma } from "@/generated/prisma/client"`
 * (value-import) and do NOT yet import from `decimal.js`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VO_ROOT = resolve(__dirname, "..");

function readVO(rel: string): string {
  return readFileSync(resolve(VO_ROOT, rel), "utf-8");
}

// Value-import regex: line-anchored, multiline. Matches:
//   import { Prisma } from "@/generated/prisma/client"
//   import { Prisma, X } from "@/generated/prisma/client"
//   import {Prisma} from '@/generated/prisma/client'
// Does NOT match `import type { ... }` (type-only imports are erased at
// compile time and do NOT pull runtime modules into the bundle).
const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

// Decimal.js default-import regex (per decimal.d.ts: `export default Decimal`).
const DECIMAL_DEFAULT_IMPORT_RE =
  /^import\s+Decimal\s+from\s*["']decimal\.js["']/m;

describe("sentinel: decimal.js import-shape — shared/domain/value-objects (sub-POC 1 Cycle 1)", () => {
  it("money.ts does NOT value-import Prisma from @/generated/prisma/client", () => {
    const src = readVO("money.ts");
    expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
  });

  it("money.ts default-imports Decimal from decimal.js", () => {
    const src = readVO("money.ts");
    expect(src).toMatch(DECIMAL_DEFAULT_IMPORT_RE);
  });

  it("monetary-amount.ts does NOT value-import Prisma from @/generated/prisma/client", () => {
    const src = readVO("monetary-amount.ts");
    expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
  });

  it("monetary-amount.ts default-imports Decimal from decimal.js", () => {
    const src = readVO("monetary-amount.ts");
    expect(src).toMatch(DECIMAL_DEFAULT_IMPORT_RE);
  });
});
