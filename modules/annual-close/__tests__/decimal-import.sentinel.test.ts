/**
 * Sentinel: DEC-1 + W-6 — annual-close domain + application import-hygiene.
 *
 * Asserts that no file under `modules/annual-close/{domain,application}/**​/*.ts`:
 *   (a) value-imports `Prisma` from `@/generated/prisma/client` (DEC-1 — only
 *       `import type { Prisma } from ...` is permitted in those layers).
 *   (b) imports the symbol `eq` from `@/modules/accounting/shared/domain/money.utils`
 *       (W-6 — tolerance-based equality is FORBIDDEN in annual-close balance gates;
 *       only `Decimal.equals` (bit-perfect) is allowed).
 *
 * Infrastructure adapters under `modules/annual-close/infrastructure/` are
 * intentionally excluded — they ARE the Prisma adapter boundary (DEC-1 §2).
 *
 * Regex notes (per [[sentinel_regex_line_bound]]):
 *  - PRISMA_VALUE_IMPORT_RE — line-bound `[^\n]*` to avoid paren-class drift.
 *  - MONEY_UTILS_EQ_IMPORT_RE — line-bound; matches a named import that brings
 *    `eq` from the canonical money-utils path. Aliased re-imports (`as eq`)
 *    intentionally excluded — surface as drift if they ever appear.
 *
 * Declared failure mode (pre-GREEN, Phase 0.2 RED):
 *  - `readdirSync` over `modules/annual-close/{domain,application}` throws
 *    `ENOENT` because those subdirectories do not exist yet at HEAD c81adfec.
 *    Per [[red_acceptance_failure_mode]] this is the legitimate RED failure
 *    mode: skeleton test asserts a structural invariant the module has not
 *    yet been built to satisfy.
 *
 * GREEN flips at Phase 3.9 once the domain + application files exist (none of
 * them value-importing `Prisma`, none importing `eq` from money.utils).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODULE_ROOT = resolve(__dirname, "..");
const SCANNED_LAYERS = ["domain", "application"] as const;

const PRISMA_VALUE_IMPORT_RE =
  /^[^\n]*import\s*\{[^\n}]*\bPrisma\b[^\n}]*\}\s*from\s*["']@\/generated\/prisma\/client["'][^\n]*$/m;

const MONEY_UTILS_EQ_IMPORT_RE =
  /^[^\n]*import\s*\{[^\n}]*\beq\b[^\n}]*\}\s*from\s*["']@\/modules\/accounting\/shared\/domain\/money\.utils["'][^\n]*$/m;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Exclude __tests__ — sentinel itself lives there and intentionally
      // mentions the forbidden symbols inside string literals / regexes.
      if (entry === "__tests__") continue;
      out.push(...walkTs(full));
    } else if (st.isFile() && /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectLayerFiles(): string[] {
  const all: string[] = [];
  for (const layer of SCANNED_LAYERS) {
    all.push(...walkTs(resolve(MODULE_ROOT, layer)));
  }
  return all;
}

describe("sentinel: DEC-1 + W-6 — annual-close domain + application import-hygiene", () => {
  it("scans at least one .ts file under domain/ + application/ (module exists)", () => {
    const files = collectLayerFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it("no domain/application file value-imports Prisma from @/generated/prisma/client (DEC-1)", () => {
    const offenders: string[] = [];
    for (const abs of collectLayerFiles()) {
      const src = readFileSync(abs, "utf-8");
      if (PRISMA_VALUE_IMPORT_RE.test(src)) offenders.push(abs);
    }
    expect(offenders).toEqual([]);
  });

  it("no domain/application file imports `eq` from money.utils (W-6)", () => {
    const offenders: string[] = [];
    for (const abs of collectLayerFiles()) {
      const src = readFileSync(abs, "utf-8");
      if (MONEY_UTILS_EQ_IMPORT_RE.test(src)) offenders.push(abs);
    }
    expect(offenders).toEqual([]);
  });
});
