import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * C4 RED — Atomic consumer cutover shape tests for POC ai-agent-hex migration.
 *
 * Verifies all 16 consumers import from `modules/ai-agent/presentation/*`
 * instead of `features/ai-agent/*`.
 *
 * AXIS-DISTINCT vs dispatch C4 paired sister (cb3f7a7d / e3e6ad8b):
 * - Dual-barrel mock split: 5 server-barrel mocks (presentation/server)
 *   + 2 client-barrel mocks (presentation/client) — FIRST dual-barrel cutover
 *   in codebase per D5 dual-barrel convention (locked at C3).
 *
 * Consumer map (16 cases):
 * - 9 runtime consumers
 *   - 4 API route server-barrel imports
 *   - 1 API route index-barrel import (analyzeDocument)
 *   - 2 client-barrel imports (registrar-con-ia + journal-entry-ai-modal index.tsx)
 *   - 2 type-only imports (registrar-con-ia/types.ts + journal-entry-ai-modal/types.ts)
 * - 7 vi.mock declarations
 *   - 5 server-barrel mocks (route.test.ts files)
 *   - 2 client-barrel mocks (registrar-con-ia .test.tsx files)
 *
 * PRE-RED failure mode: ASSERTION MISMATCH (NOT ENOENT — consumer files exist
 * with old `@/features/ai-agent/*` imports). `expect(content).not.toContain
 * ("features/ai-agent")` FAILS because the substring IS found.
 *
 * Per [[red_acceptance_failure_mode]]: failure mode explicitly named —
 * assertion mismatch on substring, NOT module resolution error.
 */

const root = join(__dirname, "../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf-8");
}

describe("POC ai-agent-hex C4 — atomic consumer cutover", () => {
  // ── Runtime server-barrel consumers (4) ─────────────────────────────────

  it("agent/route.ts imports from modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/agent/route.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("balance-sheet/analyze/route.ts imports from modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze/route.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("income-statement/analyze/route.ts imports from modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/income-statement/analyze/route.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("accounts/route.ts imports from modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/accounts/route.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  // ── Runtime index-barrel consumer (1) — analyzeDocument ─────────────────

  it("api/analyze/route.ts imports analyzeDocument from modules/ai-agent/presentation", () => {
    const content = readFile("app/api/analyze/route.ts");
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation");
  });

  // ── Runtime client-barrel consumers (2) ─────────────────────────────────

  it("registrar-con-ia/index.tsx imports useAgentQuery from modules/ai-agent/presentation/client", () => {
    const content = readFile("components/agent/registrar-con-ia/index.tsx");
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/client");
  });

  it("journal-entry-ai-modal/index.tsx imports useAgentQuery from modules/ai-agent/presentation/client", () => {
    const content = readFile(
      "components/accounting/journal-entry-ai-modal/index.tsx",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/client");
  });

  // ── Runtime type-only consumers (2) ─────────────────────────────────────

  it("registrar-con-ia/types.ts imports AgentSuggestion from modules/ai-agent", () => {
    const content = readFile("components/agent/registrar-con-ia/types.ts");
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent");
  });

  it("journal-entry-ai-modal/types.ts imports from modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "components/accounting/journal-entry-ai-modal/types.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  // ── vi.mock server-barrel rewrites (5) ──────────────────────────────────

  it("balance-sheet/analyze/__tests__/route.test.ts mocks modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("income-statement/analyze/__tests__/route.test.ts mocks modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/financial-statements/income-statement/analyze/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("agent/__tests__/route.confirm-log-mortality.test.ts mocks modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-log-mortality.test.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("agent/__tests__/route.confirm-create-expense.test.ts mocks modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-create-expense.test.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  it("agent/__tests__/route.confirm-journal-entry.test.ts mocks modules/ai-agent/presentation/server", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/server");
  });

  // ── vi.mock client-barrel rewrites (2) ──────────────────────────────────

  it("registrar-con-ia-wire-up.test.tsx mocks modules/ai-agent/presentation/client", () => {
    const content = readFile(
      "components/agent/registrar-con-ia/__tests__/registrar-con-ia-wire-up.test.tsx",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/client");
  });

  it("registrar-con-ia.test.tsx mocks modules/ai-agent/presentation/client", () => {
    const content = readFile(
      "components/agent/registrar-con-ia/__tests__/registrar-con-ia.test.tsx",
    );
    expect(content).not.toContain("features/ai-agent");
    expect(content).toContain("modules/ai-agent/presentation/client");
  });
});
