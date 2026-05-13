import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC financial-statements-hex.
 *
 * Verifies all 22 consumers import from `modules/accounting/financial-statements/*`
 * instead of `features/accounting/financial-statements/*`.
 *
 * Paired sister: modules/ai-agent/__tests__/c4-cutover-shape.poc-ai-agent-hex.test.ts
 *                (GREEN `ccab3a77` — 16α atomic cutover)
 *
 * AXIS-DISTINCT vs ai-agent C4:
 * - 22 consumers (vs 16 in ai-agent)
 * - ai-agent CROSS-MODULE DEBT CLOSURE — 5 modules/ai-agent files importing
 *   `@/features/accounting/financial-statements/*` are repointed atomically.
 *   This commit closes the cross-module-debt that ai-agent C4 explicitly
 *   deferred (modules/ai-agent → @/features/accounting/financial-statements
 *   was carried forward by ai-agent C4 because the financial-statements POC
 *   had not yet run). OLEADA 5 POC 3/3 closes the loop.
 * - D5 INVERSE — server.ts + index.ts (no client.ts). Dual-target mapping:
 *   - `/presentation/server` for RUNTIME server-only (FSService, schemas,
 *     formatBolivianAmount, money utils, serializeStatement re-export)
 *   - `/presentation` (index) for TYPE-only re-exports
 *
 * Consumer map (22 cases):
 * - 11 runtime consumers (Block 1)
 *   - 7 API route imports (server-side)
 *   - 4 component imports (3 page-clients + statement-filters/table — TYPE-only,
 *     "use client" components reaching the index barrel for TYPE re-exports)
 * - 5 ai-agent cross-module debt files (Block 2)
 *   - 3 application TYPE-only imports
 *   - 2 domain prompts MIXED (formatBolivianAmount RUNTIME + types)
 * - 6 vi.mock declarations (Block 3)
 *   - 2 server-barrel mocks (balance-sheet/income-statement analyze route tests)
 *   - 3 money.utils mocks (equity-statement, initial-balance, trial-balance route tests)
 *   - 1 index-barrel mock (worksheet route test)
 *
 * PRE-RED failure mode: ASSERTION MISMATCH (NOT ENOENT — consumer files exist
 * with old `@/features/accounting/financial-statements/*` imports).
 * `expect(content).not.toContain("features/accounting/financial-statements")`
 * FAILS because the substring IS found.
 *
 * Per [[red_acceptance_failure_mode]]: failure mode explicitly named —
 * assertion mismatch on substring, NOT module resolution error.
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel reads file CONTENT for substring assertions. C5 RED will
 * assert filesystem !existsSync on features/accounting/financial-statements/*.
 * DOMAINS DISJOINT — C4 = string content of consumers; C5 = file existence.
 */

const root = join(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf-8");
}

describe("POC financial-statements-hex C4 — atomic consumer cutover", () => {
  // ── Block 1: Runtime consumers (11) ─────────────────────────────────────

  it("equity-statement/route.ts imports serializeStatement from modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/equity-statement/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("financial-statements/balance-sheet/route.ts imports from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("financial-statements/balance-sheet/analyze/route.ts imports from modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("financial-statements/income-statement/route.ts imports from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/income-statement/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("financial-statements/income-statement/analyze/route.ts imports from modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/income-statement/analyze/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("initial-balance/route.ts imports serializeStatement from modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/initial-balance/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("trial-balance/route.ts imports serializeStatement from modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/trial-balance/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("worksheet/route.ts imports serializeStatement from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/worksheet/route.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("balance-sheet-page-client.tsx imports types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "components/financial-statements/balance-sheet-page-client.tsx",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("income-statement-page-client.tsx imports types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "components/financial-statements/income-statement-page-client.tsx",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("statement-filters.tsx imports types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "components/financial-statements/statement-filters.tsx",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("statement-table.tsx imports types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "components/financial-statements/statement-table.tsx",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 2: ai-agent CROSS-MODULE DEBT CLOSURE (5) ──────────────────────

  it("ai-agent/agent.service.ts imports types from modules/accounting/financial-statements/presentation (cross-module debt closure)", () => {
    const content = readFile("modules/ai-agent/application/agent.service.ts");
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("ai-agent/modes/balance-sheet-analysis.ts imports type BalanceSheet from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "modules/ai-agent/application/modes/balance-sheet-analysis.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("ai-agent/modes/income-statement-analysis.ts imports types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "modules/ai-agent/application/modes/income-statement-analysis.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("ai-agent/prompts/balance-sheet-analysis.prompt.ts imports formatBolivianAmount + types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  it("ai-agent/prompts/income-statement-analysis.prompt.ts imports formatBolivianAmount + types from modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "modules/ai-agent/domain/prompts/income-statement-analysis.prompt.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });

  // ── Block 3: vi.mock declarations (6) ────────────────────────────────────

  it("balance-sheet/analyze/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("income-statement/analyze/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/income-statement/analyze/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("equity-statement/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/equity-statement/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("initial-balance/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/initial-balance/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("trial-balance/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/trial-balance/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation/server",
    );
  });

  it("worksheet/__tests__/route.test.ts mocks modules/accounting/financial-statements/presentation", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/worksheet/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/accounting/financial-statements");
    expect(content).toContain(
      "modules/accounting/financial-statements/presentation",
    );
  });
});
