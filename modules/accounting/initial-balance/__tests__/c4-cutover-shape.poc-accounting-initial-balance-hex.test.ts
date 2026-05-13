import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC accounting-initial-balance-hex.
 *
 * Verifies that route.ts and route.test.ts import from
 * `modules/accounting/initial-balance/*` instead of
 * `features/accounting/initial-balance/*`.
 *
 * Paired sister (closest): modules/accounting/worksheet/__tests__/
 *   c4-cutover-shape.poc-accounting-worksheet-hex.test.ts (GREEN cbfa03ef — 23α)
 *
 * Consumer map (2 files per design §10, IB-D5 corrected: 6 vi.mock total):
 * - route.ts: 4 import lines (InitialBalanceService, initialBalanceQuerySchema,
 *   exportInitialBalancePdf, exportInitialBalanceXlsx) — all from
 *   @/features/accounting/initial-balance/server barrel
 * - route.test.ts: 3 vi.mock repoint (service + pdf.exporter + xlsx.exporter IB paths)
 *   + 2 real-import lines (L117-118 exporters) = 5 textual IB-path sites
 *   + 3 vi.mock STAY (permissions, shared/middleware, FS presentation/server)
 *   = 6 vi.mock total (IB-D5 corrected from proposal's 5)
 *
 * PRE-RED failure mode [[red_acceptance_failure_mode]]: ASSERTION MISMATCH (NOT ENOENT)
 * — consumer files exist with old `@/features/accounting/initial-balance` imports.
 * `expect(content).not.toContain("features/accounting/initial-balance")` FAILS because
 * the substring IS found. Named explicitly — NOT module resolution error.
 *
 * Axis-distinct vs WS sister:
 * - IB service method: `generate()` (NOT `generateWorksheet()` — axis-distinct IB-D2)
 * - IB vi.mock 6 total (not 5 as in proposal): 3 repoint (service + pdf + xlsx)
 *   + 3 stay (permissions, shared/middleware, FS presentation/server)
 * - IB real-import lines L117-118: exporters imported directly in test file
 * - Block 7 sibling checks: TB + WS modules (vs WS block 7 checks TB only)
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel reads file CONTENT (substring assertions).
 * C5 RED will assert !existsSync on features/accounting/initial-balance/* files.
 * DOMAINS DISJOINT — C4 = string content; C5 = file existence.
 *
 * FS/TB/ES/WS closed-POC sentinel low-cost verification [[low_cost_verification_asymmetry]]:
 * - c4-cutover-shape.poc-financial-statements-hex.test.ts asserts
 *   initial-balance/route.test.ts mocks FS presentation/server — REMAINS PASS post-C4.
 * - TB+ES+WS c5-wholesale-delete sentinels have no initial-balance cross-module dep — trivially PASS.
 *
 * [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock paths rewritten atomically at C4 GREEN.
 * [[mock_hygiene_commit_scope]]: mock factory shape extension (makeInitialBalanceService factory mock)
 *   bundled in C4 GREEN commit — sister archive #2327 NEW INVARIANT: vi.mock returns BOTH class AND factory.
 */

const ROOT = join(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

const ROUTE_PATH =
  "app/api/organizations/[orgSlug]/initial-balance/route.ts";
const ROUTE_TEST_PATH =
  "app/api/organizations/[orgSlug]/initial-balance/__tests__/route.test.ts";

describe("POC accounting-initial-balance-hex C4 — atomic consumer cutover", () => {
  // ── Block 1: Runtime consumer cutover (route.ts) ─────────────────────────

  it("α67: initial-balance/route.ts does NOT contain features/accounting/initial-balance", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).not.toContain("features/accounting/initial-balance");
  });

  it("α68: initial-balance/route.ts imports from modules/accounting/initial-balance/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/initial-balance/presentation/server",
    );
  });

  it("α69: initial-balance/route.ts imports makeInitialBalanceService from new module path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeInitialBalanceService/m);
  });

  it("α70: initial-balance/route.ts imports initialBalanceQuerySchema from modules/accounting/initial-balance path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/initialBalanceQuerySchema/m);
  });

  it("α71: initial-balance/route.ts imports exportInitialBalancePdf from modules/accounting/initial-balance path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportInitialBalancePdf/m);
    expect(content).toMatch(/modules\/accounting\/initial-balance/m);
  });

  it("α72: initial-balance/route.ts imports exportInitialBalanceXlsx from modules/accounting/initial-balance path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportInitialBalanceXlsx/m);
    expect(content).toMatch(/modules\/accounting\/initial-balance/m);
  });

  it("α73: initial-balance/route.ts STILL imports serializeStatement from @/modules/accounting/financial-statements/presentation (FS canonical home preserved)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 2: vi.mock rewrites (route.test.ts) ─────────────────────────────
  // [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock rewrites atomic (IB paths)
  // 3 vi.mocks STAY: @/features/permissions/server, @/features/shared/middleware,
  //   @/modules/accounting/financial-statements/presentation/server

  it("α74: initial-balance/__tests__/route.test.ts does NOT contain features/accounting/initial-balance", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).not.toContain("features/accounting/initial-balance");
  });

  it("α75: route.test.ts mocks @/modules/accounting/initial-balance/application/initial-balance.service (service mock repoint)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/initial-balance/application/initial-balance.service",
    );
  });

  it("α76: route.test.ts mocks @/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter",
    );
  });

  it("α77: route.test.ts mocks @/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter",
    );
  });

  // ── Block 3: FS closed-POC sentinel verification (REQ cross-check) ───────

  it("α78: initial-balance/route.ts still imports from @/modules/accounting/financial-statements/presentation (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation",
    );
  });

  it("α79: initial-balance/__tests__/route.test.ts still mocks @/modules/accounting/financial-statements/presentation/server (FS STAY mock preserved)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  // ── Block 4: REQ-001 NEGATIVE sentinel ───────────────────────────────────

  it("α80: NO production runtime files in app/, components/, lib/, modules/ import @/features/accounting/initial-balance (except test files)", () => {
    const raw = execSync(
      "git grep '@/features/accounting/initial-balance' -- app/ components/ lib/ modules/ 2>/dev/null || true",
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
          // Exclude sentinel file string literals (test descriptions in c2 sentinel)
          !line.includes("c2-infrastructure-shape"),
      );
    expect(productionLines).toHaveLength(0);
  });

  // ── Block 5: Mock factory shape [[mock_hygiene_commit_scope]] ─────────────

  it("α81: route.test.ts vi.mock for service barrel includes mockGenerate function mock (factory pattern post-C4)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    // vi.mock must return factory shape with generate method (IB method name: generate)
    expect(content).toMatch(/mockGenerate/m);
  });

  it("α82: route.test.ts vi.mock for PDF exporter references new infrastructure path string", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /["']@\/modules\/accounting\/initial-balance\/infrastructure\/exporters\/initial-balance-pdf\.exporter["']/m,
    );
  });

  it("α83: route.test.ts vi.mock for XLSX exporter references new infrastructure path string", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /["']@\/modules\/accounting\/initial-balance\/infrastructure\/exporters\/initial-balance-xlsx\.exporter["']/m,
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

  it("α86: modules/accounting/trial-balance/** does NOT import from @/features/accounting/initial-balance", () => {
    const raw = execSync(
      "git grep '@/features/accounting/initial-balance' -- modules/accounting/trial-balance/ 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(raw.trim()).toHaveLength(0);
  });

  it("α87: modules/accounting/worksheet/** does NOT import from @/features/accounting/initial-balance", () => {
    const raw = execSync(
      "git grep '@/features/accounting/initial-balance' -- modules/accounting/worksheet/ 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(raw.trim()).toHaveLength(0);
  });

  // ── Block 8: Factory pattern + method name ────────────────────────────────

  it("α88: route.ts uses makeInitialBalanceService() factory pattern (no direct new InitialBalanceService() after cutover)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeInitialBalanceService\(\)/m);
    expect(content).not.toMatch(/new\s+InitialBalanceService\s*\(\)/m);
  });

  it("α89: route.ts calls service.generate(...) (IB method name preserved — NOT renamed)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/service\.generate\s*\(/m);
  });
});
