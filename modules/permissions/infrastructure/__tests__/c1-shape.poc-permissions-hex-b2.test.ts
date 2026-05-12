/**
 * RED test — poc-permissions-hex B2 (infrastructure): structural shape assertions C1.
 *
 * 11α declarations. Expected failure mode pre-GREEN:
 *   FAIL (11α): hex infra files non-existent; features/ SHIMs still source impl
 *   - α1  FAIL: modules/permissions/infrastructure/permissions.cache.ts non-existent (existsSync)
 *   - α2  FAIL: hex permissions.cache.ts non-existent → readFileSync throws (getMatrix)
 *   - α3  FAIL: hex permissions.cache.ts non-existent → readFileSync throws (ensureOrgSeeded)
 *   - α4  FAIL: hex permissions.cache.ts non-existent → readFileSync throws (export type OrgMatrix)
 *   - α5  FAIL: modules/permissions/infrastructure/__tests__/permissions.cache.test.ts non-existent
 *   - α6  FAIL: modules/permissions/infrastructure/cache.ts non-existent
 *   - α7  FAIL: hex infrastructure/cache.ts non-existent → readFileSync throws
 *   - α8  FAIL: features/permissions/permissions.cache.ts SHIM not in place → no `export type { OrgMatrix }`
 *   - α9  FAIL: features/permissions/permissions.cache.ts SHIM not in place → no _setLoader/_resetCache named re-export
 *   - α10 FAIL: features/permissions/permissions.cache.ts SHIM not in place → no hex import path
 *   - α11 FAIL: features/permissions/cache.ts SHIM JSDoc banner absent
 *
 * Gate: run pre-GREEN → 11/11α FAIL before proceeding to GREEN.
 *
 * Paired sister: poc-shared-audit infra (SHA 69178f3f) — Option B SHIM precedent for isolatedModules + types.
 * [[red_acceptance_failure_mode]]: every α declares expected failure mode (above).
 * [[red_regex_discipline]]: ^...m anchor for export decls; named re-export block with /s flag.
 * [[cross_cycle_red_test_cementacion_gate]]: B2 α paths (infrastructure/) disjoint from B3 (application/).
 *   Step 0 grep: 0 hits — verified before commit.
 * [[sub_phase_start_coherence_gate]]: B1 closure validated (domain/ files + SHIMs in place).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_CACHE = join(ROOT, "modules/permissions/infrastructure/permissions.cache.ts");
const HEX_CACHE_BARREL = join(ROOT, "modules/permissions/infrastructure/cache.ts");
const HEX_TESTS_DIR = join(ROOT, "modules/permissions/infrastructure/__tests__");
const SHIM_CACHE = join(ROOT, "features/permissions/permissions.cache.ts");
const SHIM_CACHE_BARREL = join(ROOT, "features/permissions/cache.ts");

// ── α1: hex infrastructure permissions.cache.ts existence ────────────────────

describe("α1 hex infrastructure permissions.cache.ts exists", () => {
  it("α1: modules/permissions/infrastructure/permissions.cache.ts exists", () => {
    expect(existsSync(HEX_CACHE)).toBe(true);
  });
});

// ── α2–α4: hex permissions.cache.ts content sentinels ────────────────────────

describe("α2–α4 hex permissions.cache.ts content sentinels", () => {
  it("α2: hex permissions.cache.ts exports getMatrix function + has server-only directive", () => {
    const content = readFileSync(HEX_CACHE, "utf-8");
    expect(content).toMatch(/^export async function getMatrix/m);
    expect(content).toMatch(/^import ["']server-only["']/m);
  });

  it("α3: hex permissions.cache.ts exports ensureOrgSeeded + revalidateOrgMatrix + _setLoader + _resetCache", () => {
    const content = readFileSync(HEX_CACHE, "utf-8");
    expect(content).toMatch(/^export async function ensureOrgSeeded/m);
    expect(content).toMatch(/^export function revalidateOrgMatrix/m);
    expect(content).toMatch(/^export function _setLoader/m);
    expect(content).toMatch(/^export function _resetCache/m);
  });

  it("α4: hex permissions.cache.ts declares export type OrgMatrix", () => {
    const content = readFileSync(HEX_CACHE, "utf-8");
    expect(content).toMatch(/^export type OrgMatrix\s*=/m);
  });
});

// ── α5: hex __tests__/permissions.cache.test.ts existence ────────────────────

describe("α5 hex infrastructure __tests__/permissions.cache.test.ts exists", () => {
  it("α5: modules/permissions/infrastructure/__tests__/permissions.cache.test.ts exists", () => {
    expect(existsSync(join(HEX_TESTS_DIR, "permissions.cache.test.ts"))).toBe(true);
  });
});

// ── α6–α7: hex infrastructure cache.ts barrel ────────────────────────────────

describe("α6–α7 hex infrastructure/cache.ts barrel", () => {
  it("α6: modules/permissions/infrastructure/cache.ts exists", () => {
    expect(existsSync(HEX_CACHE_BARREL)).toBe(true);
  });

  it("α7: hex infrastructure/cache.ts forwards ./permissions.cache + has server-only", () => {
    const content = readFileSync(HEX_CACHE_BARREL, "utf-8");
    expect(content).toMatch(/^export \* from ["']\.\/permissions\.cache["']/m);
    expect(content).toMatch(/^import ["']server-only["']/m);
  });
});

// ── α8–α10: SHIM at features/permissions/permissions.cache.ts (Option B) ─────

describe("α8–α10 features/permissions/permissions.cache.ts SHIM (Option B)", () => {
  it("α8: SHIM contains `export type { OrgMatrix }` (isolatedModules-compliant)", () => {
    const content = readFileSync(SHIM_CACHE, "utf-8");
    expect(content).toMatch(/export type \{[^}]*\bOrgMatrix\b/);
  });

  it("α9: SHIM exports test hooks _setLoader + _resetCache in named re-export block from hex path", () => {
    const content = readFileSync(SHIM_CACHE, "utf-8");
    const namedReexport = /export \{[^}]*\b_setLoader\b[^}]*\b_resetCache\b[^}]*\}\s*from ["']@\/modules\/permissions\/infrastructure\/permissions\.cache["']/s;
    expect(content).toMatch(namedReexport);
  });

  it("α10: SHIM imports from hex path @/modules/permissions/infrastructure/permissions.cache", () => {
    const content = readFileSync(SHIM_CACHE, "utf-8");
    expect(content).toMatch(/from ["']@\/modules\/permissions\/infrastructure\/permissions\.cache["']/);
  });
});

// ── α11: SHIM at features/permissions/cache.ts (Option A) ────────────────────

describe("α11 features/permissions/cache.ts SHIM (Option A barrel)", () => {
  it("α11: features/permissions/cache.ts has SHIM banner + forwards ./permissions.cache", () => {
    const content = readFileSync(SHIM_CACHE_BARREL, "utf-8");
    expect(content).toMatch(/Re-exports moved to hex/);
    expect(content).toMatch(/^export \* from ["']\.\/permissions\.cache["']/m);
  });
});
