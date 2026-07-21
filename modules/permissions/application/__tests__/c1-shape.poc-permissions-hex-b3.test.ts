/**
 * RED test — poc-permissions-hex B3 (application): structural shape assertions C1.
 *
 * 19α declarations. α1–α11 are HEX-existence sentinels (still valid). α12–α19 were
 * SHIM-existence / re-export-shape / 84-vi.mock-count sentinels — INVERTED to
 * retirement/absence sentinels after permissions-shim-cutover deleted the 7
 * features/permissions/ SHIMs and repointed all 84 vi.mock consumers onto the
 * hex barrel @/modules/permissions/application/server (delete + absence sentinel
 * per repo convention: [[c1-hubservice-retirement]], c7-wholesale-delete-shape).
 *
 *   - α1  PASS: modules/permissions/application/permissions.server.ts exists
 *   - α2  PASS: hex permissions.server.ts exports requirePermission + server-only
 *   - α3  PASS: hex permissions.server.ts exports canAccess + canPost
 *   - α4  PASS: modules/permissions/application/client-matrix.ts exists
 *   - α5  PASS: hex client-matrix.ts exports buildClientMatrixSnapshot
 *   - α6  PASS: modules/permissions/application/__tests__/require-permission.test.ts exists
 *   - α7  PASS: modules/permissions/application/__tests__/client-matrix.test.ts exists
 *   - α8  PASS: modules/permissions/application/server.ts exists
 *   - α9  PASS: hex application/server.ts re-exports requirePermission + server-only
 *   - α10 PASS: hex application/server.ts re-exports _setLoader + _resetCache
 *   - α11 PASS: hex application/server.ts re-exports type OrgMatrix
 *   - α12 RETIRED: features/permissions/server.ts SHIM deleted; hex owns canPost
 *   - α13 RETIRED: SHIM deleted; hex application/server.ts re-exports _setLoader + _resetCache
 *   - α14 RETIRED: SHIM deleted; hex application/server.ts re-exports type OrgMatrix
 *   - α15 RETIRED: features/permissions/permissions.server.ts SHIM deleted
 *   - α16 RETIRED: features/permissions/client-matrix.ts SHIM deleted
 *   - α17 RETIRED: SHIM server.ts symbol surface fully retired to hex barrel
 *   - α18 RETIRED: vi.mock("@/features/permissions/server") count === 0 (all 84 repointed to hex)
 *     Key retirement proof: OLD-path count === 0 AND NEW-path (hex) count > 0.
 *   - α19 RETIRED: features/permissions/server.ts SHIM deleted; hex barrel canonical
 *
 * Gate: post-cutover → 19/19α PASS (hex-existence + retirement/absence sentinels).
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

// ── α12–α17: RETIREMENT sentinels — features/permissions/ app SHIMs DELETED ───
//   Inverted from SHIM-existence/re-export-shape assertions per repo retirement
//   convention ([[c1-hubservice-retirement]], c7-wholesale-delete-shape: delete
//   + absence sentinel). The application SHIMs (server.ts, permissions.server.ts,
//   client-matrix.ts) were retired after permissions-shim-cutover repointed all
//   consumers onto hex paths. The hex application barrel is now the sole surface.

describe("α12–α14 features/permissions/server.ts SHIM RETIRED (absence sentinels)", () => {
  it("α12: SHIM features/permissions/server.ts is RETIRED (no longer exists); hex owns canPost", () => {
    expect(existsSync(SHIM_SERVER)).toBe(false);
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/\bcanPost\b/);
  });

  it("α13: SHIM server.ts retired; hex application/server.ts re-exports _setLoader + _resetCache", () => {
    expect(existsSync(SHIM_SERVER)).toBe(false);
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/export \{[^}]*\b_setLoader\b[^}]*\b_resetCache\b[^}]*\}/s);
  });

  it("α14: SHIM server.ts retired; hex application/server.ts re-exports type OrgMatrix", () => {
    expect(existsSync(SHIM_SERVER)).toBe(false);
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/export type \{[^}]*\bOrgMatrix\b/);
  });
});

// ── α15–α16: SHIMs features/permissions/{permissions.server, client-matrix}.ts RETIRED ─

describe("α15–α16 features/permissions/{permissions.server, client-matrix}.ts SHIMs RETIRED", () => {
  it("α15: SHIM features/permissions/permissions.server.ts is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_PSERVER)).toBe(false);
    expect(existsSync(HEX_PSERVER)).toBe(true);
  });

  it("α16: SHIM features/permissions/client-matrix.ts is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_CLIENT_MATRIX)).toBe(false);
    expect(existsSync(HEX_CLIENT_MATRIX)).toBe(true);
  });
});

// ── α17: RETIREMENT — SHIM server.ts symbol surface fully retired to hex ──────

describe("α17 features/permissions/server.ts symbol surface RETIRED (absence sentinel)", () => {
  it("α17: SHIM server.ts retired; hex application/server.ts owns full symbol surface", () => {
    expect(existsSync(SHIM_SERVER)).toBe(false);
    const content = readFileSync(HEX_SERVER, "utf-8");
    expect(content).toMatch(/\brequirePermission\b/);
    expect(content).toMatch(/\bcanAccess\b/);
    expect(content).toMatch(/\bcanPost\b/);
    expect(content).toMatch(/\bbuildClientMatrixSnapshot\b/);
  });
});

// ── α18: DUAL-SENTINEL — baseline 92 vi.mock count invariant ─────────────────

describe("α18 RETIREMENT sentinel — deprecated @/features/permissions/server vi.mock path fully retired (was 84, now 0; repointed to hex barrel)", () => {
  it("α18: vi.mock count for the RETIRED @/features/permissions/server SHIM path equals 0 (fully repointed to hex)", () => {
    // RETIREMENT sentinel (inverted from the 84-count invariant). permissions-shim-cutover
    // moved all 84 vi.mock declarations from the deprecated SHIM path
    // @/features/permissions/server → the hex barrel @/modules/permissions/application/server.
    // The key retirement proof is OLD-path count === 0. We also assert the NEW-path count
    // is present (> 0) to confirm the mocks were repointed, not deleted.
    //
    // Historical drift ledger (pre-retirement, count was 84 — preserved for provenance):
    //   - poc-dispatch-retirement-into-sales C3 GREEN: dispatches/__tests__/page.test.ts
    //     rewritten as redirect-shim test (-1)
    //   - poc-dispatch-retirement-into-sales C1 GREEN: dispatches-hub/__tests__/route.test.ts
    //     DELETED with endpoint (-1)
    //   - sidebar-reorg-settings-hub C3 GREEN: settings/__tests__/page.test.ts NEW —
    //     mocks canAccess to verify per-card RBAC filter and entry-gate broadening (+1)
    //   - accounting-dashboard-pro Phase 7 GREEN: app/(dashboard)/[orgSlug]/accounting/__tests__/page.test.ts
    //     mocks canAccess to verify pro-vs-light dual-view branching at the hub (+1).
    //     (Phase 6's DashboardLight refactored to receive allowedResources as a prop —
    //     canAccess moved to the server page — so no light-view consumer mock.)
    //   - annual-close Phase 5.4 GREEN: app/api/organizations/[orgSlug]/annual-close/__tests__/route.test.ts
    //     mocks requirePermission to assert 403 on RBAC reject + RBAC call shape (+1).
    //   - annual-close Phase 7.5 GREEN: app/(dashboard)/[orgSlug]/settings/periods/__tests__/page-annual-grouping.test.tsx
    //     NEW — mocks requirePermission to assert preserved RBAC gate on the year-grouped periods page (+1).
    //     (renamed .test.ts → .test.tsx by test-isolation cleanup so it runs in the jsdom
    //      "components" project; still counted here via the grep's --include="*.tsx".)
    //   - equity-statement T07: app/api/organizations/[orgSlug]/equity-statement/__tests__/route.test.ts
    //     NEW — mocks requirePermission for the equity-statement GET route handler (+1).
    //   - contact-ledger 6170bce7: app/api/organizations/[orgSlug]/contact-ledger/__tests__/route.test.ts
    //     NEW — RED route contract for contact-ledger (+1).
    //   - contact-balances dashboard eeea0869: app/api/organizations/[orgSlug]/contact-balances/dashboard/__tests__/route.test.ts
    //     NEW — RED route contract for /contact-balances/dashboard (+1).
    //   - 1 additional untracked post-86 driver between bumps (likely cxc/cxp or
    //     financial-statements analyze route gaining requirePermission mock).
    //   - agent-surface-separation F1+F2: app/api/organizations/[orgSlug]/agent/__tests__/route.surface-validation.surface-separation.test.ts
    //     NEW — mocks requirePermission alongside the 3 pre-existing route.confirm-*.test.ts
    //     siblings to spy parsed.surface propagation through agentService.query (+1).
    //   - agent-sidebar-module-hint C1: app/api/organizations/[orgSlug]/agent/__tests__/route.module-hint.test.ts
    //     NEW — mocks requirePermission to spy parsed.module_hint -> moduleHint
    //     propagation at the 9th positional arg of agentService.query (+1).
    //   - baseline-test-cleanup C1 (this SDD):
    //       app/api/organizations/[orgSlug]/journal/[entryId]/__tests__/route.json.test.ts (+1)
    //       app/api/organizations/[orgSlug]/tags/__tests__/route.post.test.ts (+1)
    //       app/api/organizations/[orgSlug]/tags/__tests__/route.test.ts (+1)
    //     PRE-EXISTING drivers — count was drifting silent; this SDD re-enumerates per
    //     [[invariant_collision_elevation]] + [[low_cost_verification_asymmetry]].
    //   - lcv-feature-retirement L6: modules/iva-books/ DELETED entirely (RND 102100000011).
    //     10 iva-books test files contained vi.mock("@/features/permissions/server") — all removed (-10).
    //   - pago-credit-system Phase 5: app/api/organizations/[orgSlug]/payments/apply-credits/__tests__/route.test.ts
    //     NEW — RED route contract for the credit-source XOR (receivableId|payableId)
    //     apply-credits endpoint; mocks requirePermission like its sibling route tests (+1).
    // REQ-010 invariant preserved; drifts accounted explicit per [[invariant_collision_elevation]].
    //   -1 (test-isolation cleanup): roles/[roleSlug]/__tests__/self-lock-integration.test.ts
    //   previously had TWO vi.mock("@/features/permissions/server") lines (async importOriginal
    //   at :130 + plain factory at :140). The duplicate caused ORDER-DEPENDENT mock resolution:
    //   the async-importOriginal factory left requirePermission REAL via ...actual, so the test
    //   passed in the full suite but FAILED in isolation. The dead async-importOriginal mock was
    //   removed, leaving the single plain factory. So 84 consumer FILES = 84 matched LINES now.
    //   Verified: zero new/unauthorized consumers added → the legitimate count is 84.
    const oldCmd = `grep -rE "vi\\.mock\\(\\s*['\\"]@/features/permissions/server['\\"]" "${ROOT}" --include="*.test.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git 2>/dev/null | grep -v "c1-shape.poc-permissions-hex-b3.test.ts" | wc -l`;
    const oldCount = Number(execSync(oldCmd, { encoding: "utf-8" }).trim());
    // KEY retirement sentinel: the deprecated SHIM path has ZERO remaining mock consumers.
    expect(oldCount).toBe(0);

    const newCmd = `grep -rE "vi\\.mock\\(\\s*['\\"]@/modules/permissions/application/server['\\"]" "${ROOT}" --include="*.test.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git 2>/dev/null | grep -v "c1-shape.poc-permissions-hex-b3.test.ts" | wc -l`;
    const newCount = Number(execSync(newCmd, { encoding: "utf-8" }).trim());
    // Confirmation: the mocks were REPOINTED to hex, not deleted.
    expect(newCount).toBeGreaterThan(0);
  }, 30000);
});

// ── α19: RETIREMENT — SHIM features/permissions/server.ts deleted; hex is canonical ─
//        Inverted from the SHIM-imports-hex assertion. The SHIM no longer exists;
//        the hex application/server.ts is the canonical aggregate barrel.

describe("α19 features/permissions/server.ts SHIM RETIRED (absence sentinel)", () => {
  it("α19: SHIM features/permissions/server.ts is RETIRED (no longer exists); hex application/server.ts is canonical", () => {
    expect(existsSync(SHIM_SERVER)).toBe(false);
    expect(existsSync(HEX_SERVER)).toBe(true);
  });
});
