/**
 * RED test — poc-permissions-hex B3 (application): structural shape assertions C1.
 *
 * 19α declarations. Expected failure mode pre-GREEN:
 *   FAIL (18α) + PASS (α18 dual-sentinel baseline 84-vi.mock count invariant)
 *
 *   - α1  FAIL: modules/permissions/application/permissions.server.ts non-existent
 *   - α2  FAIL: hex permissions.server.ts non-existent → readFileSync throws (requirePermission)
 *   - α3  FAIL: hex permissions.server.ts non-existent → readFileSync throws (canAccess + canPost)
 *   - α4  FAIL: modules/permissions/application/client-matrix.ts non-existent
 *   - α5  FAIL: hex client-matrix.ts non-existent → readFileSync throws (buildClientMatrixSnapshot)
 *   - α6  FAIL: modules/permissions/application/__tests__/require-permission.test.ts non-existent
 *   - α7  FAIL: modules/permissions/application/__tests__/client-matrix.test.ts non-existent
 *   - α8  FAIL: modules/permissions/application/server.ts non-existent
 *   - α9  FAIL: hex application/server.ts non-existent → readFileSync throws (requirePermission re-export)
 *   - α10 FAIL: hex application/server.ts non-existent → readFileSync throws (_setLoader + _resetCache)
 *   - α11 FAIL: hex application/server.ts non-existent → readFileSync throws (OrgMatrix export type)
 *   - α12 FAIL: features/permissions/server.ts SHIM not in place → no named `export { canPost` from hex
 *   - α13 FAIL: features/permissions/server.ts SHIM not in place → no named `export { _setLoader, _resetCache` from hex cache
 *   - α14 FAIL: features/permissions/server.ts SHIM not in place → no `export type { OrgMatrix }` from hex
 *   - α15 FAIL: features/permissions/permissions.server.ts SHIM not in place → no hex application path
 *   - α16 FAIL: features/permissions/client-matrix.ts SHIM not in place → no hex application path
 *   - α17 FAIL: features/permissions/server.ts symbol surface mismatch (no named re-exports to hex yet)
 *   - α18 PASS: vi.mock("@/features/permissions/server") count === 84 (DUAL-SENTINEL — baseline invariant)
 *     If α18 ≠ 84: STOP — unauthorized consumer edit detected pre-GREEN.
 *   - α19 FAIL: features/permissions/server.ts does NOT yet import from "@/modules/permissions/application"
 *
 * Gate: run pre-GREEN → 18α FAIL + 1α PASS (α18). Post-GREEN: 19α PASS.
 *
 * Paired sister: poc-shared-canonical umbrella (c15abb4c); poc-shared-base-repo (5517966d).
 * [[red_acceptance_failure_mode]]: every α declares expected failure mode (above).
 * [[cross_cycle_red_test_cementacion_gate]]: B3 is last sub-POC — no future cycle.
 *   Step 0 grep confirmed 0 pre-existing B3 paths.
 * [[sub_phase_start_coherence_gate]]: B1+B2 closure validated.
 * [[invariant_collision_elevation]]: 84-vi.mock invariant locked as α18 dual-sentinel
 *   per spec REQ-010 — no collision; additive invariant.
 */

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_PSERVER = join(ROOT, "modules/permissions/application/permissions.server.ts");
const HEX_CLIENT_MATRIX = join(ROOT, "modules/permissions/application/client-matrix.ts");
const HEX_SERVER = join(ROOT, "modules/permissions/application/server.ts");
const HEX_TESTS_DIR = join(ROOT, "modules/permissions/application/__tests__");
const SHIM_PSERVER = join(ROOT, "features/permissions/permissions.server.ts");
const SHIM_CLIENT_MATRIX = join(ROOT, "features/permissions/client-matrix.ts");
const SHIM_SERVER = join(ROOT, "features/permissions/server.ts");

// ── α1–α3: hex permissions.server.ts ─────────────────────────────────────────

describe("α1–α3 hex permissions.server.ts", () => {
  it("α1: modules/permissions/application/permissions.server.ts exists", () => {
    expect(existsSync(HEX_PSERVER)).toBe(true);
  });

  it("α2: hex permissions.server.ts exports requirePermission + has server-only", () => {
    const content = readFileSync(HEX_PSERVER, "utf-8");
    expect(content).toMatch(/^export async function requirePermission/m);
    expect(content).toMatch(/^import ["']server-only["']/m);
  });

  it("α3: hex permissions.server.ts exports canAccess + canPost", () => {
    const content = readFileSync(HEX_PSERVER, "utf-8");
    expect(content).toMatch(/^export async function canAccess/m);
    expect(content).toMatch(/^export async function canPost/m);
  });
});

// ── α4–α5: hex client-matrix.ts ──────────────────────────────────────────────

describe("α4–α5 hex client-matrix.ts", () => {
  it("α4: modules/permissions/application/client-matrix.ts exists", () => {
    expect(existsSync(HEX_CLIENT_MATRIX)).toBe(true);
  });

  it("α5: hex client-matrix.ts exports buildClientMatrixSnapshot", () => {
    const content = readFileSync(HEX_CLIENT_MATRIX, "utf-8");
    expect(content).toMatch(/^export async function buildClientMatrixSnapshot/m);
  });
});

// ── α6–α7: co-located tests ──────────────────────────────────────────────────

describe("α6–α7 hex application __tests__", () => {
  it("α6: modules/permissions/application/__tests__/require-permission.test.ts exists", () => {
    expect(existsSync(join(HEX_TESTS_DIR, "require-permission.test.ts"))).toBe(true);
  });

  it("α7: modules/permissions/application/__tests__/client-matrix.test.ts exists", () => {
    expect(existsSync(join(HEX_TESTS_DIR, "client-matrix.test.ts"))).toBe(true);
  });
});

// ── α8–α11: hex application/server.ts aggregate barrel ───────────────────────

describe("α8–α11 hex application/server.ts aggregate barrel", () => {
  it("α8: modules/permissions/application/server.ts exists", () => {
    expect(existsSync(HEX_SERVER)).toBe(true);
  });

  it("α9: hex application/server.ts re-exports requirePermission from permissions.server + has server-only", () => {
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/^import ["']server-only["']/m);
    expect(content).toMatch(/\brequirePermission\b/);
  });

  it("α10: hex application/server.ts re-exports _setLoader + _resetCache from cache infra", () => {
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/export \{[^}]*\b_setLoader\b[^}]*\b_resetCache\b[^}]*\}/s);
  });

  it("α11: hex application/server.ts re-exports type OrgMatrix from cache infra", () => {
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/export type \{[^}]*\bOrgMatrix\b/);
  });
});

// ── α12–α14: SHIM features/permissions/server.ts (Option B aggregate) ────────

describe("α12–α14 features/permissions/server.ts SHIM (Option B aggregate)", () => {
  it("α12: SHIM features/permissions/server.ts has named `canPost` re-export from hex application path", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    const reexport = /export \{[^}]*\bcanPost\b[^}]*\}\s*from ["']@\/modules\/permissions\/application\//s;
    expect(content).toMatch(reexport);
  });

  it("α13: SHIM features/permissions/server.ts has named `_setLoader` + `_resetCache` re-export from hex infra path", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    const reexport = /export \{[^}]*\b_setLoader\b[^}]*\b_resetCache\b[^}]*\}\s*from ["']@\/modules\/permissions\/infrastructure\/permissions\.cache["']/s;
    expect(content).toMatch(reexport);
  });

  it("α14: SHIM features/permissions/server.ts has `export type { OrgMatrix }` from hex infra path", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    const reexport = /export type \{[^}]*\bOrgMatrix\b[^}]*\}\s*from ["']@\/modules\/permissions\/infrastructure\/permissions\.cache["']/s;
    expect(content).toMatch(reexport);
  });
});

// ── α15–α16: SHIMs features/permissions/{permissions.server, client-matrix}.ts (Option B) ─

describe("α15–α16 features/permissions/{permissions.server, client-matrix}.ts SHIMs (Option B)", () => {
  it("α15: SHIM features/permissions/permissions.server.ts has named re-exports from hex application path", () => {
    const content = readFileSync(SHIM_PSERVER, "utf-8");
    const reexport = /export \{[^}]*\brequirePermission\b[^}]*\bcanAccess\b[^}]*\bcanPost\b[^}]*\}\s*from ["']@\/modules\/permissions\/application\/permissions\.server["']/s;
    expect(content).toMatch(reexport);
  });

  it("α16: SHIM features/permissions/client-matrix.ts has named `buildClientMatrixSnapshot` from hex application path", () => {
    const content = readFileSync(SHIM_CLIENT_MATRIX, "utf-8");
    const reexport = /export \{[^}]*\bbuildClientMatrixSnapshot\b[^}]*\}\s*from ["']@\/modules\/permissions\/application\/client-matrix["']/s;
    expect(content).toMatch(reexport);
  });
});

// ── α17: SHIM features/permissions/server.ts symbol surface — all 6 values + 1 type ─

describe("α17 SHIM features/permissions/server.ts symbol surface (Option B aggregate)", () => {
  it("α17: SHIM features/permissions/server.ts exports requirePermission + canAccess + canPost + buildClientMatrixSnapshot all named from hex", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    const appReexport = /export \{[^}]*\brequirePermission\b[^}]*\bcanAccess\b[^}]*\bcanPost\b[^}]*\}\s*from ["']@\/modules\/permissions\/application\//s;
    const cmReexport = /export \{[^}]*\bbuildClientMatrixSnapshot\b[^}]*\}\s*from ["']@\/modules\/permissions\/application\/client-matrix["']/s;
    expect(content).toMatch(appReexport);
    expect(content).toMatch(cmReexport);
  });
});

// ── α18: DUAL-SENTINEL — baseline 84 vi.mock count invariant ─────────────────

describe("α18 DUAL-SENTINEL — baseline 82 vi.mock count (REQ-010 invariant, drifted -2 by poc-dispatch-retirement-into-sales C3+C1)", () => {
  it("α18: vi.mock count for @/features/permissions/server equals 82 (baseline preserved; -2 drift from /dispatches + /dispatches-hub retirement)", () => {
    // Counts grep hits for vi.mock("@/features/permissions/server") across consumer tests,
    // EXCLUDING this shape sentinel file (which mentions the pattern in JSDoc and would self-match).
    // Original baseline: 84. Adjusted to 82 by poc-dispatch-retirement-into-sales:
    //   - C3 GREEN: dispatches/__tests__/page.test.ts rewritten as redirect-shim test (-1)
    //   - C1 GREEN: dispatches-hub/__tests__/route.test.ts DELETED with endpoint (-1)
    // REQ-010 invariant preserved; drifts accounted explicit per [[invariant_collision_elevation]].
    const cmd = `grep -rE "vi\\.mock\\(\\s*['\\"]@/features/permissions/server['\\"]" "${ROOT}" --include="*.test.ts" --include="*.tsx" 2>/dev/null | grep -v "c1-shape.poc-permissions-hex-b3.test.ts" | wc -l`;
    const stdout = execSync(cmd, { encoding: "utf-8" }).trim();
    const count = Number(stdout);
    expect(count).toBe(82);
  });
});

// ── α19: SHIM features/permissions/server.ts does NOT yet have hex application re-export (pre-GREEN sentinel)
//        Post-GREEN: this α flips — it MUST have the hex re-export to PASS. To remain a clean
//        dual-state α we re-shape: SHIM MUST eventually have hex import.

describe("α19 SHIM features/permissions/server.ts hex application path import", () => {
  it("α19: SHIM features/permissions/server.ts contains `from \"@/modules/permissions/application\"` (any application re-export)", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    expect(content).toMatch(/from ["']@\/modules\/permissions\/application\//);
  });
});
