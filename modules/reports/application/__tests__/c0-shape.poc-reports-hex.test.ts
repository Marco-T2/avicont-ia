/**
 * RED test — poc-reports-hex: structural shape assertions C0.
 *
 * 14α declarations. Expected failure mode pre-GREEN:
 *   FAIL (12α): α1,α3,α4,α6,α7,α8,α9,α10,α11,α12,α13,α14
 *   PASS-pre-GREEN (2α):
 *     - α2  PASS (lock-only honest): features/reports/index.ts already exists (5 LOC barrel,
 *           no server-only). File is the active SHIM and is never deleted pre-GREEN.
 *           [[red_acceptance_failure_mode]]: no precondition makes this file absent at C0 commit time.
 *     - α5  PASS (trivially): SHIM currently has no `import "server-only"` (client-safe barrel).
 *           Treated as GREEN invariant — must REMAIN PASS across all cycles.
 *           Not a FAIL-expecting sentinel; listed for explicit negative coverage per REQ-005.
 *
 * Gate: run pre-GREEN → 12/14α FAIL + 2/14α PASS (α2 lock + α5 trivial) before C1 GREEN.
 *
 * Paired sister: poc-auth-hex — SHA ac497dda (C0) / 693a51c4 (C1) / d9d63849 (C2)
 *   modules/auth/application/__tests__/c0-shape.poc-auth-hex.test.ts
 * [[paired_sister_default_no_surface]] — EXACT mirror with 4 declared divergences:
 *   1. No `import "server-only"` (client-safe static data — sister auth had server-only)
 *   2. SHIM exports VALUES + TYPES (2 lines — sister was values-only 1 line)
 *   3. 6-op C1 atomic (vs sister 4-file — +2 ops for 2 heredado tests vs sister 1)
 *   4. 2 heredado tests, zero vi.mock (sister had 1 test + 3 vi.mock targets)
 * [[red_regex_discipline]] — `^...$m` anchors for all export/import assertions.
 * [[red_acceptance_failure_mode]] — α2 PASS-lock + α5 trivially PASS declared honest.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ROOT: 4 levels deep — modules/reports/application/__tests__/
const ROOT = join(__dirname, "../../../..");

const CANONICAL      = join(ROOT, "modules/reports/application/catalog.ts");
const SHIM           = join(ROOT, "features/reports/index.ts");
const LEGACY_CATALOG = join(ROOT, "features/reports/catalog.ts");
const HEREDADO_TEST_1 = join(ROOT, "modules/reports/application/__tests__/catalog.test.ts");
const HEREDADO_TEST_2 = join(ROOT, "modules/reports/application/__tests__/catalog-icons.test.ts");

// ── α1: canonical catalog existence ──────────────────────────────────────────

describe("α1 canonical reports catalog exists", () => {
  it("α1: modules/reports/application/catalog.ts exists", () => {
    expect(existsSync(CANONICAL)).toBe(true);
  });
});

// ── α2: SHIM existence (PASS-lock — file already exists) ─────────────────────

describe("α2 SHIM features/reports/index.ts exists (PASS-lock)", () => {
  it("α2: features/reports/index.ts exists (PASS pre-GREEN by design — active barrel)", () => {
    expect(existsSync(SHIM)).toBe(true);
  });
});

// ── α3–α4: SHIM content sentinels (values + types → canonical path) ──────────

describe("α3–α4 SHIM features/reports/index.ts content sentinels", () => {
  it("α3: SHIM exports reportCategories + reportRegistry from canonical hex path", () => {
    const content = readFileSync(SHIM, "utf-8");
    expect(content).toMatch(
      /^export \{ reportCategories, reportRegistry \} from "@\/modules\/reports\/application\/catalog";$/m,
    );
  });

  it("α4: SHIM exports types ReportCategory, ReportEntry, ReportStatus from canonical hex path", () => {
    const content = readFileSync(SHIM, "utf-8");
    expect(content).toMatch(
      /^export type \{ ReportCategory, ReportEntry, ReportStatus \} from "@\/modules\/reports\/application\/catalog";$/m,
    );
  });
});

// ── α5: SHIM no-server-only NEGATIVE sentinel (REQ-005, trivially PASS) ──────

describe("α5 SHIM does NOT contain import \"server-only\" (REQ-005 NEGATIVE sentinel)", () => {
  it("α5: features/reports/index.ts has NO `import \"server-only\"` (client-safe — trivially PASS pre-GREEN)", () => {
    const content = readFileSync(SHIM, "utf-8");
    expect(/import ['"]server-only['"];?/.test(content)).toBe(false);
  });
});

// ── α6: canonical no-server-only NEGATIVE sentinel (REQ-005) ─────────────────
// Pre-GREEN: file non-existent → readFileSync throws → test FAILS (treated as assertion fail)

describe("α6 canonical does NOT contain import \"server-only\" (REQ-005 NEGATIVE sentinel)", () => {
  it("α6: modules/reports/application/catalog.ts has NO `import \"server-only\"`", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(/import ['"]server-only['"];?/.test(content)).toBe(false);
  });
});

// ── α7–α11: canonical catalog value + type exports ───────────────────────────

describe("α7–α11 canonical catalog exports values and types", () => {
  it("α7: canonical catalog exports `reportCategories` const", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(content).toMatch(/^export const reportCategories\b/m);
  });

  it("α8: canonical catalog exports `reportRegistry` const", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(content).toMatch(/^export const reportRegistry\b/m);
  });

  it("α9: canonical catalog exports `ReportCategory` interface", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(content).toMatch(/^export interface ReportCategory\b/m);
  });

  it("α10: canonical catalog exports `ReportEntry` interface", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(content).toMatch(/^export interface ReportEntry\b/m);
  });

  it("α11: canonical catalog exports `ReportStatus` type", () => {
    const content = readFileSync(CANONICAL, "utf-8");
    expect(content).toMatch(/^export type ReportStatus\b/m);
  });
});

// ── α12: legacy catalog must NOT exist post-relocation ───────────────────────

describe("α12 legacy features/reports/catalog.ts removed", () => {
  it("α12: features/reports/catalog.ts does NOT exist", () => {
    expect(existsSync(LEGACY_CATALOG)).toBe(false);
  });
});

// ── α13–α14: relocated heredado tests existence ───────────────────────────────

describe("α13–α14 relocated heredado tests exist at canonical path", () => {
  it("α13: modules/reports/application/__tests__/catalog.test.ts exists", () => {
    expect(existsSync(HEREDADO_TEST_1)).toBe(true);
  });

  it("α14: modules/reports/application/__tests__/catalog-icons.test.ts exists", () => {
    expect(existsSync(HEREDADO_TEST_2)).toBe(true);
  });
});
