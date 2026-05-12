/**
 * RED test — poc-permissions-hex B1 (domain): structural shape assertions C1.
 *
 * 15α declarations. Expected failure mode pre-GREEN:
 *   FAIL (15α): hex domain files non-existent; features/ SHIMs still source impl
 *   - α1  FAIL: modules/permissions/domain/permissions.ts non-existent (existsSync)
 *   - α2  FAIL: hex permissions.ts non-existent → readFileSync throws
 *   - α3  FAIL: hex permissions.ts non-existent → readFileSync throws
 *   - α4  FAIL: hex permissions.ts non-existent → readFileSync throws (type Role)
 *   - α5  FAIL: modules/permissions/domain/__tests__/permissions.test.ts non-existent
 *   - α6  FAIL: modules/permissions/domain/index.ts non-existent
 *   - α7  FAIL: hex domain/index.ts non-existent → readFileSync throws
 *   - α8  FAIL: features/permissions/permissions.ts SHIM not in place → no `export type { Role`
 *   - α9  FAIL: features/permissions/permissions.ts SHIM not in place → no hex import path
 *   - α10 FAIL: features/permissions/index.ts unchanged (currently `export * from "./permissions"` — same form, but no JSDoc SHIM banner yet)
 *   - α11 FAIL: features/permissions/permissions.ts still has SYSTEM_ROLES const decl
 *   - α12 FAIL: SHIM forwards named values (10 const exports) — not in place
 *   - α13 FAIL: SHIM forwards `getPostAllowedRoles` named export — not in place
 *   - α14 FAIL: hex permissions.ts has POST_ALLOWED_ROLES const internal (preserved from source)
 *   - α15 FAIL: hex domain/__tests__/permissions.types.test.ts non-existent
 *
 * Gate: run pre-GREEN → 15/15α FAIL before proceeding to GREEN.
 *
 * Paired sister: poc-shared-base-repo C1 RED (SHA 5517966d) —
 *   modules/shared/infrastructure/__tests__/c1-shape.poc-shared-base-repo.test.ts.
 * [[red_acceptance_failure_mode]]: every α declares expected failure mode (above).
 * [[red_regex_discipline]]: ^...m anchor for import statements; \?? optional pattern for TYPE exports.
 * [[cross_cycle_red_test_cementacion_gate]]: B1 α paths (domain/) confirmed disjoint
 *   from B2 (infrastructure/) and B3 (application/) — Step 0 grep: 0 hits.
 * [[paired_sister_default_no_surface]]: sister style (fs content-inspection over runtime import)
 *   applied directly — avoids vitest server-only side-effect AND keeps sentinels filesystem-rooted.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_PERMISSIONS = join(ROOT, "modules/permissions/domain/permissions.ts");
const HEX_INDEX = join(ROOT, "modules/permissions/domain/index.ts");
const HEX_TESTS_DIR = join(ROOT, "modules/permissions/domain/__tests__");
const SHIM_PERMISSIONS = join(ROOT, "features/permissions/permissions.ts");
const SHIM_INDEX = join(ROOT, "features/permissions/index.ts");

// ── α1: hex domain permissions.ts existence ──────────────────────────────────

describe("α1 hex domain permissions.ts exists", () => {
  it("α1: modules/permissions/domain/permissions.ts exists", () => {
    expect(existsSync(HEX_PERMISSIONS)).toBe(true);
  });
});

// ── α2–α4: hex permissions.ts content sentinels ──────────────────────────────

describe("α2–α4 hex permissions.ts content sentinels", () => {
  it("α2: hex permissions.ts exports PERMISSIONS_READ const", () => {
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/^export const PERMISSIONS_READ/m);
  });

  it("α3: hex permissions.ts exports PERMISSIONS_WRITE + PERMISSIONS_CLOSE + PERMISSIONS_REOPEN", () => {
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/^export const PERMISSIONS_WRITE/m);
    expect(content).toMatch(/^export const PERMISSIONS_CLOSE/m);
    expect(content).toMatch(/^export const PERMISSIONS_REOPEN/m);
  });

  it("α4: hex permissions.ts declares type Role + types Resource/Action/DocumentScope/PostableResource", () => {
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/^export type Role = string/m);
    expect(content).toMatch(/^export type Resource\s*=/m);
    expect(content).toMatch(/^export type Action\s*=/m);
    expect(content).toMatch(/^export type DocumentScope\s*=/m);
    expect(content).toMatch(/^export type PostableResource\s*=/m);
  });
});

// ── α5: hex __tests__ permissions.test.ts existence ──────────────────────────

describe("α5 hex domain __tests__/permissions.test.ts exists", () => {
  it("α5: modules/permissions/domain/__tests__/permissions.test.ts exists", () => {
    expect(existsSync(join(HEX_TESTS_DIR, "permissions.test.ts"))).toBe(true);
  });
});

// ── α6–α7: hex domain index.ts ───────────────────────────────────────────────

describe("α6–α7 hex domain/index.ts", () => {
  it("α6: modules/permissions/domain/index.ts exists", () => {
    expect(existsSync(HEX_INDEX)).toBe(true);
  });

  it("α7: hex domain/index.ts is bare barrel forwarding ./permissions", () => {
    const content = readFileSync(HEX_INDEX, "utf-8");
    expect(content).toMatch(/^export \* from ["']\.\/permissions["']/m);
  });
});

// ── α8–α13: SHIM at features/permissions/permissions.ts (Option B) ───────────

describe("α8–α13 features/permissions/permissions.ts SHIM (Option B)", () => {
  it("α8: SHIM contains `export type { Role` (isolatedModules-compliant)", () => {
    const content = readFileSync(SHIM_PERMISSIONS, "utf-8");
    expect(content).toMatch(/export type \{[^}]*\bRole\b/);
  });

  it("α9: SHIM imports from hex path @/modules/permissions/domain/permissions", () => {
    const content = readFileSync(SHIM_PERMISSIONS, "utf-8");
    expect(content).toMatch(/from ["']@\/modules\/permissions\/domain\/permissions["']/);
  });

  it("α10: features/permissions/index.ts SHIM banner present (Option A barrel forwarding SHIM)", () => {
    const content = readFileSync(SHIM_INDEX, "utf-8");
    expect(content).toMatch(/^export \* from ["']\.\/permissions["']/m);
    expect(content).toMatch(/Re-exports moved to hex/);
  });

  it("α11: SHIM features/permissions/permissions.ts does NOT contain SYSTEM_ROLES const declaration", () => {
    const content = readFileSync(SHIM_PERMISSIONS, "utf-8");
    expect(content).not.toMatch(/^export const SYSTEM_ROLES/m);
  });

  it("α12: SHIM exports 10 named values via named re-export block from hex path", () => {
    const content = readFileSync(SHIM_PERMISSIONS, "utf-8");
    // Named re-export block: { SYSTEM_ROLES, ... } from "@/modules/permissions/domain/permissions"
    const namedReexport = /export \{[^}]*SYSTEM_ROLES[^}]*\bisSystemRole\b[^}]*\bPERMISSIONS_READ\b[^}]*\}\s*from ["']@\/modules\/permissions\/domain\/permissions["']/s;
    expect(content).toMatch(namedReexport);
  });

  it("α13: SHIM forwards `getPostAllowedRoles` named export from hex path (internal seed accessor preserved)", () => {
    const content = readFileSync(SHIM_PERMISSIONS, "utf-8");
    // getPostAllowedRoles must appear inside a named re-export block pointing at hex
    const reexport = /export \{[^}]*\bgetPostAllowedRoles\b[^}]*\}\s*from ["']@\/modules\/permissions\/domain\/permissions["']/s;
    expect(content).toMatch(reexport);
  });
});

// ── α14: hex permissions.ts preserves internal POST_ALLOWED_ROLES (verbatim relocation) ─

describe("α14 hex permissions.ts preserves internal POST_ALLOWED_ROLES const", () => {
  it("α14: hex permissions.ts contains POST_ALLOWED_ROLES non-exported const", () => {
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/^const POST_ALLOWED_ROLES/m);
  });
});

// ── α15: hex domain __tests__/permissions.types.test.ts existence ────────────

describe("α15 hex domain __tests__/permissions.types.test.ts exists", () => {
  it("α15: modules/permissions/domain/__tests__/permissions.types.test.ts exists", () => {
    expect(existsSync(join(HEX_TESTS_DIR, "permissions.types.test.ts"))).toBe(true);
  });
});
