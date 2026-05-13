import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC accounting-worksheet-hex.
 *
 * Verifies that route.ts and route.test.ts import from
 * `modules/accounting/worksheet/*` instead of
 * `features/accounting/worksheet/*`.
 *
 * Paired sister: modules/accounting/trial-balance/__tests__/
 *   c4-cutover-shape.poc-accounting-trial-balance-hex.test.ts (GREEN e99f9c0a — 23α)
 *
 * Consumer map (2 files, 8 textual sites per design §14):
 * - route.ts: 4 import lines (WorksheetService, worksheetQuerySchema, exportWorksheetPdf,
 *   exportWorksheetXlsx) — all from @/features/accounting/worksheet/server barrel
 * - route.test.ts: 3 vi.mock declarations + 1 type-ref inside importOriginal
 *   at lines 56-74 (server + pdf.exporter + xlsx.exporter worksheet paths)
 *
 * PRE-RED failure mode [[red_acceptance_failure_mode]]: ASSERTION MISMATCH (NOT ENOENT)
 * — consumer files exist with old `@/features/accounting/worksheet` imports.
 * `expect(content).not.toContain("features/accounting/worksheet")` FAILS because
 * the substring IS found. Named explicitly — NOT module resolution error.
 *
 * Axis-distinct vs TB sister:
 * - WS route.ts has NO PrismaWorksheetRepo direct instantiation (simpler than TB)
 * - WS service method: `generateWorksheet()` (NOT `generate()`)
 * - WS vi.mock 6 total: 3 repoint (worksheet) + 3 stay (permissions, shared/middleware, FS)
 * - WS exporters: direct vi.mock paths (NOT bare imports like TB)
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel reads file CONTENT (substring assertions).
 * C5 RED will assert !existsSync on features/accounting/worksheet/* files.
 * DOMAINS DISJOINT — C4 = string content; C5 = file existence.
 *
 * FS/TB/ES closed-POC sentinel low-cost verification [[low_cost_verification_asymmetry]]:
 * - c4-cutover-shape.poc-financial-statements-hex.test.ts asserts
 *   worksheet/route.ts contains "modules/accounting/financial-statements/presentation".
 *   REMAINS PASS post-C4 because route.ts serializeStatement from FS is UNTOUCHED.
 * - TB+ES c5-wholesale-delete sentinels have no worksheet cross-module dep — trivially PASS.
 *
 * [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock paths rewritten atomically at C4 GREEN.
 * [[mock_hygiene_commit_scope]]: mock factory shape extension (makeWorksheetService factory mock)
 *   bundled in C4 GREEN commit — sister archive #2298 + #2312 NEW INVARIANT #3.
 */

const ROOT = join(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

const ROUTE_PATH =
  "app/api/organizations/[orgSlug]/worksheet/route.ts";
const ROUTE_TEST_PATH =
  "app/api/organizations/[orgSlug]/worksheet/__tests__/route.test.ts";

describe("POC accounting-worksheet-hex C4 — atomic consumer cutover", () => {
  // ── Block 1: Runtime consumer cutover (route.ts) ─────────────────────────

  it("α67: worksheet/route.ts does NOT contain features/accounting/worksheet", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).not.toContain("features/accounting/worksheet");
  });

  it("α68: worksheet/route.ts imports WorksheetService from modules/accounting/worksheet/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/worksheet/presentation/server",
    );
  });

  it("α69: worksheet/route.ts imports makeWorksheetService from modules/accounting/worksheet/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeWorksheetService/m);
  });

  it("α70: worksheet/route.ts imports worksheetQuerySchema from modules/accounting/worksheet/presentation/server", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/worksheetQuerySchema/m);
  });

  it("α71: worksheet/route.ts imports exportWorksheetPdf from modules/accounting/worksheet path (infrastructure or server barrel)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportWorksheetPdf/m);
    expect(content).toMatch(/modules\/accounting\/worksheet/m);
  });

  it("α72: worksheet/route.ts imports exportWorksheetXlsx from modules/accounting/worksheet path", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/exportWorksheetXlsx/m);
    expect(content).toMatch(/modules\/accounting\/worksheet/m);
  });

  it("α73: worksheet/route.ts STILL imports serializeStatement from @/modules/accounting/financial-statements/presentation (FS canonical home preserved)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 2: vi.mock rewrites (route.test.ts) ─────────────────────────────
  // [[cross_module_boundary_mock_target_rewrite]]: 3 vi.mock rewrites atomic

  it("α74: worksheet/__tests__/route.test.ts does NOT contain features/accounting/worksheet", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).not.toContain("features/accounting/worksheet");
  });

  it("α75: route.test.ts mocks @/modules/accounting/worksheet/presentation/server (primary server mock)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/worksheet/presentation/server",
    );
  });

  it("α76: route.test.ts mocks @/modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter",
    );
  });

  it("α77: route.test.ts mocks @/modules/accounting/worksheet/infrastructure/exporters/worksheet-xlsx.exporter", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/worksheet/infrastructure/exporters/worksheet-xlsx.exporter",
    );
  });

  // ── Block 3: FS closed-POC sentinel verification (REQ cross-check) ───────

  it("α78: worksheet/route.ts still imports from @/modules/accounting/financial-statements/presentation (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation",
    );
  });

  it("α79: worksheet/__tests__/route.test.ts still mocks @/modules/accounting/financial-statements/presentation (FS sentinel continues to PASS)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 4: REQ-001 NEGATIVE sentinel ───────────────────────────────────

  it("α80: NO production runtime files in app/, components/, lib/, modules/ import @/features/accounting/worksheet (except test files)", () => {
    const raw = execSync(
      "git grep '@/features/accounting/worksheet' -- app/ components/ lib/ modules/ 2>/dev/null || true",
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

  it("α81: route.test.ts vi.mock for server barrel includes makeWorksheetService factory mock (route uses factory post-C4)", () => {
    const content = readFile(ROUTE_TEST_PATH);
    // vi.mock must return factory shape (design §13 R6 + sister archive #2298 + #2312)
    expect(content).toMatch(/makeWorksheetService/m);
  });

  it("α82: route.test.ts vi.mock for PDF exporter references new infrastructure path", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /["']@\/modules\/accounting\/worksheet\/infrastructure\/exporters\/worksheet-pdf\.exporter["']/m,
    );
  });

  it("α83: route.test.ts vi.mock for XLSX exporter references new infrastructure path", () => {
    const content = readFile(ROUTE_TEST_PATH);
    expect(content).toMatch(
      /["']@\/modules\/accounting\/worksheet\/infrastructure\/exporters\/worksheet-xlsx\.exporter["']/m,
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

  it("α86: app/(dashboard)/.../worksheet/__tests__/page.test.ts does NOT reference features/accounting/worksheet (conditional — file exists, has 0 refs)", () => {
    const pageTestPath = join(
      ROOT,
      "app/(dashboard)/[orgSlug]/accounting/worksheet/__tests__/page.test.ts",
    );
    if (existsSync(pageTestPath)) {
      const content = readFileSync(pageTestPath, "utf-8");
      expect(content).not.toContain("features/accounting/worksheet");
    } else {
      // File absent — assertion trivially passes
      expect(true).toBe(true);
    }
  });

  it("α87: modules/accounting/trial-balance/** does NOT import from @/features/accounting/worksheet", () => {
    const raw = execSync(
      "git grep '@/features/accounting/worksheet' -- modules/accounting/trial-balance/ 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(raw.trim()).toHaveLength(0);
  });

  // ── Block 8: Factory pattern + method name ────────────────────────────────

  it("α88: route.ts uses makeWorksheetService() factory pattern (no direct new WorksheetService())", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/makeWorksheetService\(\)/m);
    expect(content).not.toMatch(/new\s+WorksheetService\s*\(\)/m);
  });

  it("α89: route.ts calls service.generateWorksheet(...) (worksheet-specific method name preserved)", () => {
    const content = readFile(ROUTE_PATH);
    expect(content).toMatch(/service\.generateWorksheet\s*\(/m);
  });
});
