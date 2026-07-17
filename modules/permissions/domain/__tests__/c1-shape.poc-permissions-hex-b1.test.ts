/**
 * RED test — poc-permissions-hex B1 (domain): structural shape assertions C1.
 *
 * 15α declarations. α1–α7, α14, α15 are HEX-existence sentinels (still valid).
 * α8–α13 were SHIM-existence sentinels — INVERTED to retirement/absence sentinels
 * after permissions-shim-cutover deleted features/permissions/ (all consumers
 * repointed to hex; delete + absence sentinel per repo convention).
 *   - α1  PASS: modules/permissions/domain/permissions.ts exists
 *   - α2  PASS: hex permissions.ts exports PERMISSIONS_READ
 *   - α3  PASS: hex permissions.ts exports PERMISSIONS_WRITE/CLOSE/REOPEN
 *   - α4  PASS: hex permissions.ts declares type Role + Resource/Action/DocumentScope/PostableResource
 *   - α5  PASS: modules/permissions/domain/__tests__/permissions.test.ts exists
 *   - α6  PASS: modules/permissions/domain/index.ts exists
 *   - α7  PASS: hex domain/index.ts bare barrel forwarding ./permissions
 *   - α8  RETIRED: features/permissions/permissions.ts SHIM no longer exists (absence sentinel)
 *   - α9  RETIRED: SHIM gone; hex permissions.ts is sole Role source
 *   - α10 RETIRED: features/permissions/index.ts SHIM barrel no longer exists
 *   - α11 RETIRED: no permissions.ts SHIM residue
 *   - α12 RETIRED: SHIM re-export block gone; hex owns SYSTEM_ROLES + named values
 *   - α13 RETIRED: getPostAllowedRoles hex-owned (SHIM forward gone)
 *   - α14 PASS: hex permissions.ts has POST_ALLOWED_ROLES const internal (preserved)
 *   - α15 PASS: hex domain/__tests__/permissions.types.test.ts exists
 *
 * Gate: post-cutover → 15/15α PASS (hex-existence + retirement/absence sentinels).
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

// ── α8–α13: RETIREMENT sentinels — features/permissions/ SHIMs DELETED ────────
//   Inverted from SHIM-existence assertions per repo retirement convention
//   ([[c1-hubservice-retirement]], c7-wholesale-delete-shape: delete + absence
//   sentinel). The domain SHIMs (permissions.ts, index.ts) were retired after
//   permissions-shim-cutover repointed all consumers onto hex paths. These α's
//   now lock the ABSENCE of the deprecated SHIM files.

describe("α8–α13 features/permissions/ domain SHIMs RETIRED (absence sentinels)", () => {
  it("α8: SHIM features/permissions/permissions.ts is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_PERMISSIONS)).toBe(false);
  });

  it("α9: hex permissions.ts is the canonical `Role` source (SHIM alias no longer imports hex)", () => {
    // Retirement proof: the SHIM that used to bridge into hex is gone; the hex
    // domain file remains the sole source of the Role type.
    expect(existsSync(SHIM_PERMISSIONS)).toBe(false);
    expect(existsSync(HEX_PERMISSIONS)).toBe(true);
  });

  it("α10: SHIM features/permissions/index.ts barrel is RETIRED (no longer exists)", () => {
    expect(existsSync(SHIM_INDEX)).toBe(false);
  });

  it("α11: features/permissions/ directory is fully retired (no permissions.ts SHIM residue)", () => {
    expect(existsSync(SHIM_PERMISSIONS)).toBe(false);
  });

  it("α12: hex domain/permissions.ts is the sole named-value source (SHIM re-export block retired)", () => {
    // The 10-value SHIM re-export block is gone; the hex file owns the exports.
    expect(existsSync(SHIM_PERMISSIONS)).toBe(false);
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/^export const SYSTEM_ROLES/m);
  });

  it("α13: getPostAllowedRoles hex-owned (SHIM forward retired)", () => {
    // getPostAllowedRoles no longer transits a SHIM re-export — it lives in hex.
    expect(existsSync(SHIM_PERMISSIONS)).toBe(false);
    const content = readFileSync(HEX_PERMISSIONS, "utf-8");
    expect(content).toMatch(/\bgetPostAllowedRoles\b/);
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
