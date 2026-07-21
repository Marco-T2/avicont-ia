/**
 * RED test — poc-permissions-hex B2 (infrastructure): structural shape assertions C1.
 *
 * 11α declarations. α1–α7 are HEX-existence sentinels (still valid). α8–α11 were
 * SHIM-existence sentinels — INVERTED to retirement/absence sentinels after
 * permissions-shim-cutover deleted features/permissions/ (delete + absence
 * sentinel per repo convention).
 *   - α1  PASS: modules/permissions/infrastructure/permissions.cache.ts exists
 *   - α2  PASS: hex permissions.cache.ts exports getMatrix + server-only
 *   - α3  PASS: hex permissions.cache.ts exports ensureOrgSeeded/revalidateOrgMatrix/_setLoader/_resetCache
 *   - α4  PASS: hex permissions.cache.ts re-exports type OrgMatrix from domain
 *               (the type was relocated to domain/permissions.ts by the [CACHE]
 *               type-only paydown; the cache keeps a back-compat re-export)
 *   - α5  PASS: modules/permissions/infrastructure/__tests__/permissions.cache.test.ts exists
 *   - α6  PASS: modules/permissions/infrastructure/cache.ts exists
 *   - α7  PASS: hex infrastructure/cache.ts forwards ./permissions.cache + server-only
 *   - α8  RETIRED: features/permissions/permissions.cache.ts SHIM no longer exists
 *   - α9  RETIRED: hex owns _setLoader/_resetCache (SHIM re-export gone)
 *   - α10 RETIRED: hex permissions.cache.ts canonical (SHIM alias import gone)
 *   - α11 RETIRED: features/permissions/cache.ts SHIM barrel no longer exists
 *
 * Gate: post-cutover → 11/11α PASS (hex-existence + retirement/absence sentinels).
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

  it("α4: hex permissions.cache.ts re-exports type OrgMatrix from domain (back-compat)", () => {
    // OrgMatrix DEFINITION moved to domain/permissions.ts ([CACHE] type-only
    // paydown). The cache must keep a back-compat re-export so non-application
    // consumers (./cache.ts barrel, legacy adapters) keep resolving it here.
    const content = readFileSync(HEX_CACHE, "utf-8");
    expect(content).toMatch(/^export type \{ OrgMatrix \} from ["']\.\.\/domain\/permissions["']/m);
    const domainContent = readFileSync(
      join(ROOT, "modules/permissions/domain/permissions.ts"),
      "utf-8",
    );
    expect(domainContent).toMatch(/^export type OrgMatrix\s*=/m);
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

// ── α8–α11: RETIREMENT sentinels — features/permissions/ cache SHIMs DELETED ──
//   Inverted from SHIM-existence assertions per repo retirement convention
//   ([[c1-hubservice-retirement]], c7-wholesale-delete-shape: delete + absence
//   sentinel). The infrastructure SHIMs (permissions.cache.ts, cache.ts) were
//   retired after permissions-shim-cutover repointed all consumers onto hex.

describe("α8–α10 features/permissions/ cache SHIMs RETIRED (absence sentinels)", () => {
  it("α8: SHIM features/permissions/permissions.cache.ts is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_CACHE)).toBe(false);
  });

  it("α9: hex permissions.cache.ts owns _setLoader + _resetCache (SHIM re-export retired)", () => {
    // Retirement proof: the SHIM re-export block is gone; the hex infra file is
    // the sole source of the _setLoader/_resetCache test hooks.
    expect(existsSync(SHIM_CACHE)).toBe(false);
    const content = readFileSync(HEX_CACHE, "utf-8");
    expect(content).toMatch(/^export function _setLoader/m);
    expect(content).toMatch(/^export function _resetCache/m);
  });

  it("α10: hex permissions.cache.ts is canonical (SHIM alias import retired)", () => {
    expect(existsSync(SHIM_CACHE)).toBe(false);
    expect(existsSync(HEX_CACHE)).toBe(true);
  });
});

// ── α11: RETIREMENT sentinel — features/permissions/cache.ts barrel DELETED ───

describe("α11 features/permissions/cache.ts barrel SHIM RETIRED (absence sentinel)", () => {
  it("α11: SHIM features/permissions/cache.ts is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_CACHE_BARREL)).toBe(false);
  });
});
