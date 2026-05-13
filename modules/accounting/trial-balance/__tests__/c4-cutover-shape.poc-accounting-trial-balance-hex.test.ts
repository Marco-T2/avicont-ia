import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC accounting-trial-balance-hex.
 *
 * Verifies that route.ts and route.test.ts import from
 * `modules/accounting/trial-balance/*` instead of
 * `features/accounting/trial-balance/*`.
 *
 * Paired sister: modules/accounting/financial-statements/__tests__/
 *   c4-cutover-shape.poc-financial-statements-hex.test.ts (GREEN 5e854c7c — 23α)
 *
 * Consumer map (2 files, 10 textual sites per design §16):
 * - route.ts: 4 import lines (TrialBalanceService+TrialBalanceRepository, schema,
 *   exportTrialBalancePdf, exportTrialBalanceXlsx) all from features/accounting/trial-balance/server
 * - route.test.ts: 3 vi.mock declarations + 1 type-ref inside importOriginal + 2 bare imports
 *   at lines 111-112 (exportTrialBalancePdf, exportTrialBalanceXlsx from exporters/ paths)
 *
 * PRE-RED failure mode [[red_acceptance_failure_mode]]: ASSERTION MISMATCH (NOT ENOENT)
 * — consumer files exist with old `@/features/accounting/trial-balance` imports.
 * `expect(content).not.toContain("features/accounting/trial-balance")` FAILS because
 * the substring IS found. Named explicitly — NOT module resolution error.
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel reads file CONTENT (substring assertions).
 * C5 RED will assert !existsSync on features/accounting/trial-balance/* files.
 * DOMAINS DISJOINT — C4 = string content; C5 = file existence.
 *
 * FS closed-POC sentinel low-cost verification [[low_cost_verification_asymmetry]]:
 * - c4-cutover-shape.poc-financial-statements-hex.test.ts lines 123-130 asserts
 *   trial-balance/route.ts imports from modules/accounting/financial-statements/presentation.
 *   This REMAINS PASS post-C4 because route.ts line 4 (serializeStatement from FS) is UNTOUCHED.
 * - Lines 275-282: route.test.ts contains modules/accounting/financial-statements/presentation/server.
 *   This REMAINS PASS post-C4 because route.test.ts line 81 mocks FS hex (UNTOUCHED).
 *
 * [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock paths rewritten atomically at C4 GREEN.
 * [[mock_hygiene_commit_scope]]: mock factory shape extension (makeTrialBalanceService factory mock)
 *   bundled in C4 GREEN commit — per design §13 R9 + sister archive #2282 NEW INVARIANT #3.
 */

const ROOT = join(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

const ROUTE_PATH =
  "app/api/organizations/[orgSlug]/trial-balance/route.ts";
const ROUTE_TEST_PATH =
  "app/api/organizations/[orgSlug]/trial-balance/__tests__/route.test.ts";

describe("POC accounting-trial-balance-hex C4 — atomic consumer cutover", () => {
  // ── Block 1: Runtime consumer cutover (route.ts) ─────────────────────────

  it("α67: trial-balance/route.ts does NOT contain features/accounting/trial-balance", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α68: trial-balance/route.ts imports TrialBalanceService from modules/accounting/trial-balance/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/trial-balance/presentation/server",
    );
  });

  it("α69: trial-balance/route.ts imports makeTrialBalanceService from modules/accounting/trial-balance/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeTrialBalanceService/m);
  });

  it("α70: trial-balance/route.ts imports trialBalanceQuerySchema from modules/accounting/trial-balance/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/trialBalanceQuerySchema/m);
  });

  it("α71: trial-balance/route.ts imports exportTrialBalancePdf from modules/accounting/trial-balance path (infrastructure or server barrel)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportTrialBalancePdf/m);
    expect(content).toMatch(/modules\/accounting\/trial-balance/m);
  });

  it("α72: trial-balance/route.ts imports exportTrialBalanceXlsx from modules/accounting/trial-balance path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportTrialBalanceXlsx/m);
    expect(content).toMatch(/modules\/accounting\/trial-balance/m);
  });

  it("α73: trial-balance/route.ts STILL imports serializeStatement from @/modules/accounting/financial-statements/presentation (FS canonical home preserved)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 2: vi.mock rewrites (route.test.ts) ─────────────────────────────
  // [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock + 2 bare imports atomic

  it("α74: trial-balance/__tests__/route.test.ts does NOT contain features/accounting/trial-balance", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α75: route.test.ts mocks @/modules/accounting/trial-balance/presentation/server (primary server mock)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/trial-balance/presentation/server",
    );
  });

  it("α76: route.test.ts mocks @/modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter",
    );
  });

  it("α77: route.test.ts mocks @/modules/accounting/trial-balance/infrastructure/exporters/trial-balance-xlsx.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-xlsx.exporter",
    );
  });

  // ── Block 3: FS closed-POC sentinel verification (REQ-011 cross-check) ───

  it("α78: trial-balance/route.ts still imports from @/modules/accounting/financial-statements/presentation (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation",
    );
  });

  it("α79: trial-balance/__tests__/route.test.ts still mocks @/modules/accounting/financial-statements/presentation/server (FS sentinel line 275-282 continues to PASS)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  // ── Block 4: REQ-001 NEGATIVE sentinel ───────────────────────────────────

  it("α80: NO production runtime files in app/, components/, lib/, modules/ import @/features/accounting/trial-balance (except test files)", () => {
    const raw = execSync(
      "git grep '@/features/accounting/trial-balance' -- app/ components/ lib/ modules/ 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf-8" },
    );
    const productionLines = raw
      .split("\n")
      .filter(Boolean)
      .filter(
        (line) =>
          !line.includes("__tests__") &&
          !line.includes(".test.ts") &&
          !line.includes(".spec.ts") &&
          // Exclude sentinel file string literals (JSDoc references)
          !line.includes("c2-infrastructure-shape"),
      );
    expect(productionLines).toHaveLength(0);
  });

  // ── Block 5: Mock factory shape [[mock_hygiene_commit_scope]] ─────────────

  it("α81: route.test.ts vi.mock for server barrel includes makeTrialBalanceService factory mock (route uses factory post-C4)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    // vi.mock must return factory shape (design §13 R9 + sister archive #2282 NEW INVARIANT #3)
    expect(content).toMatch(/makeTrialBalanceService/m);
  });

  it("α82: route.test.ts imports exportTrialBalancePdf from new infrastructure path (not features/)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/trial-balance\/infrastructure\/exporters\/trial-balance-pdf\.exporter["']/m,
    );
  });

  it("α83: route.test.ts imports exportTrialBalanceXlsx from new infrastructure path (not features/)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/trial-balance\/infrastructure\/exporters\/trial-balance-xlsx\.exporter["']/m,
    );
  });

  // ── Block 6: Route shape continuity ──────────────────────────────────────

  it("α84: route.ts exports runtime = 'nodejs' (unchanged — required for pdfmake + exceljs)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(
      /export\s+const\s+runtime\s*=\s*["']nodejs["']/m,
    );
  });

  it("α85: route.ts still exports GET function", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/export\s+(?:async\s+)?function\s+GET/m);
  });

  // ── Block 7: Sibling-feature PRE-C4 grep inventory ───────────────────────

  it("α86: page.test.ts vi.mock does NOT reference features/accounting/trial-balance (UNTOUCHED — mocks components/accounting/trial-balance-page-client)", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/accounting/trial-balance/__tests__/page.test.ts",
    );
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α87: page.test.ts mocks @/components/accounting/trial-balance-page-client (confirms UNTOUCHED path)", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/accounting/trial-balance/__tests__/page.test.ts",
    );
    expect(content).toContain("components/accounting/trial-balance-page-client");
  });

  // ── Block 8: Factory pattern + service.generate ───────────────────────────

  it("α88: route.ts uses makeTrialBalanceService() factory pattern (no direct new TrialBalanceService())", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeTrialBalanceService\(\)/m);
    expect(content).not.toMatch(/new\s+TrialBalanceService\s*\(\)/m);
  });

  it("α89: route.ts calls service.generate (composition-root wired)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/\.generate\s*\(/m);
  });
});
