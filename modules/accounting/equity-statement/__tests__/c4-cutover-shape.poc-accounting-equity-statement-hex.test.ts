import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC accounting-equity-statement-hex.
 *
 * Verifies that route.ts and route.test.ts import from
 * `modules/accounting/equity-statement/*` instead of
 * `features/accounting/equity-statement/*`.
 *
 * Paired sister: modules/accounting/trial-balance/__tests__/
 *   c4-cutover-shape.poc-accounting-trial-balance-hex.test.ts (GREEN e99f9c0a — 23α)
 *
 * Consumer map (2 files, 10 textual sites per design §16):
 * - route.ts: 4 import lines (EquityStatementService+EquityStatementRepository, schema,
 *   exportEquityStatementPdf, exportEquityStatementXlsx) all from @/features/accounting/equity-statement/server
 * - route.test.ts: 3 vi.mock declarations + 1 type-ref inside importOriginal + 2 bare imports
 *   at lines 96-97 (exportEquityStatementPdf, exportEquityStatementXlsx from exporters/ paths)
 *
 * PRE-RED failure mode [[red_acceptance_failure_mode]]: ASSERTION MISMATCH (NOT ENOENT)
 * — consumer files exist with old `@/features/accounting/equity-statement` imports.
 * `expect(content).not.toContain("features/accounting/equity-statement")` FAILS because
 * the substring IS found. Named explicitly — NOT module resolution error.
 *
 * AXIS-DISTINCT vs TB C4:
 * - α91/α92: route.ts uses makeEquityStatementService() factory (like TB), but ALSO
 *   drops EquityStatementRepository entirely (route.ts uses service.getOrgMetadata()
 *   instead of repo.getOrgMetadata() — design §9.1 Option A locked at C1).
 * - No additional vi.mock for PrismaEquityStatementRepo in route.test.ts (service.getOrgMetadata
 *   already mocked via factory mock which returns { generate: mockGenerate, getOrgMetadata: mockGetOrgMetadata }).
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel reads file CONTENT (substring assertions).
 * C5 RED will assert !existsSync on features/accounting/equity-statement/* files.
 * DOMAINS DISJOINT — C4 = string content; C5 = file existence.
 *
 * FS closed-POC sentinel low-cost verification [[low_cost_verification_asymmetry]]:
 * - c4-cutover-shape.poc-financial-statements-hex.test.ts asserts
 *   equity-statement/route.ts imports from modules/accounting/financial-statements/presentation.
 *   This REMAINS PASS post-C4 because route.ts imports serializeStatement from FS (UNTOUCHED).
 *
 * [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock paths rewritten atomically at C4 GREEN.
 * [[mock_hygiene_commit_scope]]: mock factory shape extension (makeEquityStatementService factory
 *   mock + getOrgMetadata on service stub) bundled in C4 GREEN commit.
 */

const ROOT = join(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

const ROUTE_PATH =
  "app/api/organizations/[orgSlug]/equity-statement/route.ts";
const ROUTE_TEST_PATH =
  "app/api/organizations/[orgSlug]/equity-statement/__tests__/route.test.ts";

describe("POC accounting-equity-statement-hex C4 — atomic consumer cutover", () => {
  // ── Block 1: Runtime consumer cutover (route.ts) ─────────────────────────

  it("α71: equity-statement/route.ts does NOT contain features/accounting/equity-statement", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α72: equity-statement/route.ts imports from modules/accounting/equity-statement/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/equity-statement/presentation/server",
    );
  });

  it("α73: equity-statement/route.ts imports makeEquityStatementService from presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeEquityStatementService/m);
  });

  it("α74: equity-statement/route.ts imports equityStatementQuerySchema from presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/equityStatementQuerySchema/m);
  });

  it("α75: equity-statement/route.ts imports exportEquityStatementPdf from modules/accounting path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportEquityStatementPdf/m);
    expect(content).toMatch(/modules\/accounting\/equity-statement/m);
  });

  it("α76: equity-statement/route.ts imports exportEquityStatementXlsx from modules/accounting path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportEquityStatementXlsx/m);
    expect(content).toMatch(/modules\/accounting\/equity-statement/m);
  });

  it("α77: equity-statement/route.ts STILL imports serializeStatement from @/modules/accounting/financial-statements/presentation (FS canonical home preserved)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 2: vi.mock rewrites (route.test.ts) ─────────────────────────────
  // [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock + 2 bare imports atomic

  it("α78: equity-statement/__tests__/route.test.ts does NOT contain features/accounting/equity-statement", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α79: route.test.ts mocks @/modules/accounting/equity-statement/presentation/server (primary server mock)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/equity-statement/presentation/server",
    );
  });

  it("α80: route.test.ts mocks @/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter",
    );
  });

  it("α81: route.test.ts mocks @/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter",
    );
  });

  // ── Block 3: FS closed-POC sentinel verification (REQ-011 cross-check) ───

  it("α82: equity-statement/route.ts still imports from @/modules/accounting/financial-statements/presentation (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation",
    );
  });

  it("α83: equity-statement/__tests__/route.test.ts still mocks @/modules/accounting/financial-statements/presentation/server (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  // ── Block 4: REQ-001 NEGATIVE sentinel ───────────────────────────────────

  it("α84: NO production runtime files in app/, components/, lib/, modules/ import @/features/accounting/equity-statement (except test files)", () => {
    const raw = execSync(
      "git grep '@/features/accounting/equity-statement' -- app/ components/ lib/ modules/ 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf-8" },
    );
    const productionLines = raw
      .split("\n")
      .filter(Boolean)
      .filter(
        (line) =>
          !line.includes("__tests__") &&
          !line.includes(".test.ts") &&
          !line.includes(".spec.ts"),
      );
    expect(productionLines).toHaveLength(0);
  });

  // ── Block 5: Mock factory shape [[mock_hygiene_commit_scope]] ─────────────

  it("α85: route.test.ts vi.mock for server barrel includes makeEquityStatementService factory mock (route uses factory post-C4)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    // vi.mock must return factory shape — route.ts post-C4 calls makeEquityStatementService()
    // factory returns { generate, getOrgMetadata } stub (AXIS-DISTINCT vs TB: includes getOrgMetadata)
    expect(content).toMatch(/makeEquityStatementService/m);
  });

  it("α86: route.test.ts imports exportEquityStatementPdf from new infrastructure path (not features/)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/equity-statement\/infrastructure\/exporters\/equity-statement-pdf\.exporter["']/m,
    );
  });

  it("α87: route.test.ts imports exportEquityStatementXlsx from new infrastructure path (not features/)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/equity-statement\/infrastructure\/exporters\/equity-statement-xlsx\.exporter["']/m,
    );
  });

  // ── Block 6: Route shape continuity ──────────────────────────────────────

  it("α88: route.ts exports runtime = 'nodejs' (unchanged — required for pdfmake + exceljs)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(
      /export\s+const\s+runtime\s*=\s*["']nodejs["']/m,
    );
  });

  it("α89: route.ts still exports GET function", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/export\s+(?:async\s+)?function\s+GET/m);
  });

  // ── Block 7: Sibling-feature PRE-C4 grep inventory ───────────────────────

  it("α90: page.test.ts (if it exists) does NOT import from @/features/accounting/equity-statement (UNTOUCHED — mocks components/ path)", () => {
    const pagePath = join(
      ROOT,
      "app/(dashboard)/[orgSlug]/accounting/equity-statement/__tests__/page.test.ts",
    );
    if (!existsSync(pagePath)) {
      // File does not exist — no features/ import possible; trivially PASS
      expect(true).toBe(true);
      return;
    }
    const content = readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  // ── Block 8: Factory pattern + repo removal verification ─────────────────

  it("α91: route.ts uses makeEquityStatementService() factory pattern (no direct new EquityStatementService())", () => {
    const content = readFile(ROUTE_PATH);
    // Post-C4: factory replaces direct instantiation
    expect(content).toMatch(/makeEquityStatementService\(\)/m);
    expect(content).not.toMatch(/new\s+EquityStatementService\s*\(\)/m);
  });

  it("α92: route.ts does NOT use EquityStatementRepository (absorbed by composition-root + service.getOrgMetadata)", () => {
    const content = readFile(ROUTE_PATH);
    // AXIS-DISTINCT vs TB: ES route has NO repo instantiation at all (service.getOrgMetadata absorbs it)
    expect(content).not.toMatch(/new\s+EquityStatementRepository\s*\(\)/m);
    expect(content).not.toMatch(/EquityStatementRepository/m);
  });

  it("α93: route.ts uses service.generate(...) call on the factory result", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/service\.generate\s*\(/m);
  });
});
