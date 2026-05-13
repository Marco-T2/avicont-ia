/**
 * C5 — Wholesale Delete: features/ai-agent/ sentinel
 * poc-ai-agent-hex · OLEADA 5 2/3
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS
 *   NOT ENOENT on the test runner itself — sentinel resolves fine.
 *   Files exist pre-delete; will be absent post-GREEN.
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister: dispatch C5 RED `80d92b47` + GREEN `0c546df4`
 * Scope drift: ~52α vs spec ~33α — C4 deferred all 19 __tests__ migrations +
 *   llm/__tests__ (1) + pricing/__tests__ (1) to C5 per drift in engram apply-progress/c4.
 *   Revised count: 51 source files = 19 top-level + 3 llm/ + 4 modes/ + 3 pricing/ + 3 tools/
 *   + 19 __tests__ + 1 llm/__tests__ + 1 pricing/__tests__ = 51 files total.
 *
 * [[red_acceptance_failure_mode]] — file-still-exists (existsSync returns true), NOT ENOENT
 * [[runtime_path_coverage_red_scope]] — Block 3: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α117..α168 enumerated explicit
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const AI_AGENT_DIR = path.resolve(process.cwd(), "features/ai-agent");

// ─── ALL 51 FILES enumerated explicit (relative to features/ai-agent/) ───────
// Category breakdown:
//   Top-level source (16): agent-context.repository.ts, agent.context.ts,
//     agent.service.ts, agent.tools.ts, agent.types.ts, agent.utils.ts,
//     agent.validation.ts, balance-sheet-analysis.prompt.ts, client.ts,
//     income-statement-analysis.prompt.ts, index.ts, journal-entry-ai.prompt.ts,
//     memory.repository.ts, rate-limit.repository.ts, rate-limit.service.ts,
//     server.ts
//   llm/ (3 source): gemini.ts, index.ts, types.ts
//   modes/ (4): balance-sheet-analysis.ts, chat.ts, income-statement-analysis.ts,
//     journal-entry-ai.ts
//   pricing/ (3 source): pricing.service.ts, pricing.types.ts, server.ts
//   tools/ (4): find-accounts.ts, find-contact.ts, index.ts, parse-operation.ts
//   __tests__/ (19): all pre-hex behavioral tests (deferred from C4 per drift)
//   llm/__tests__/ (1): gemini.test.ts
//   pricing/__tests__/ (1): poc-quick-cleanup-pricing-shape.test.ts
// Total: 16 + 3 + 4 + 3 + 4 + 19 + 1 + 1 = 51 files

const SOURCE_FILES: string[] = [
  // Top-level source files (16)
  "agent-context.repository.ts",
  "agent.context.ts",
  "agent.service.ts",
  "agent.tools.ts",
  "agent.types.ts",
  "agent.utils.ts",
  "agent.validation.ts",
  "balance-sheet-analysis.prompt.ts",
  "client.ts",
  "income-statement-analysis.prompt.ts",
  "index.ts",
  "journal-entry-ai.prompt.ts",
  "memory.repository.ts",
  "rate-limit.repository.ts",
  "rate-limit.service.ts",
  "server.ts",
  // llm/ source files (3)
  "llm/gemini.ts",
  "llm/index.ts",
  "llm/types.ts",
  // modes/ files (4)
  "modes/balance-sheet-analysis.ts",
  "modes/chat.ts",
  "modes/income-statement-analysis.ts",
  "modes/journal-entry-ai.ts",
  // pricing/ source files (3)
  "pricing/pricing.service.ts",
  "pricing/pricing.types.ts",
  "pricing/server.ts",
  // tools/ files (4)
  "tools/find-accounts.ts",
  "tools/find-contact.ts",
  "tools/index.ts",
  "tools/parse-operation.ts",
  // __tests__/ files (19) — deferred from C4 per drift (C1 ctor break)
  "__tests__/agent-context.repository.test.ts",
  "__tests__/agent.context.dispatch.test.ts",
  "__tests__/agent.service.analyze-balance.test.ts",
  "__tests__/agent.service.analyze-income.test.ts",
  "__tests__/agent.service.error-propagation.test.ts",
  "__tests__/agent.service.journal-entry-ai.test.ts",
  "__tests__/agent.validation.journal-entry-ai.test.ts",
  "__tests__/balance-sheet-analysis.integration.test.ts",
  "__tests__/balance-sheet-analysis.prompt.test.ts",
  "__tests__/hotfix.poc-2-ai-tools-writing-granjas.test.ts",
  "__tests__/income-statement-analysis.integration.test.ts",
  "__tests__/income-statement-analysis.prompt.test.ts",
  "__tests__/journal-entry-ai.prompt.test.ts",
  "__tests__/memory.repository.test.ts",
  "__tests__/rate-limit.repository.test.ts",
  "__tests__/rate-limit.service.test.ts",
  "__tests__/tools.find-accounts.test.ts",
  "__tests__/tools.find-contact.test.ts",
  "__tests__/tools.parse-operation.test.ts",
  // llm/__tests__/ (1)
  "llm/__tests__/gemini.test.ts",
  // pricing/__tests__/ (1)
  "pricing/__tests__/poc-quick-cleanup-pricing-shape.test.ts",
];

// ─── Block 1 — File existence checks (51α) ────────────────────────────────────
// α117..α167 — FILE-STILL-EXISTS pre-GREEN; PASS post-GREEN (existsSync returns false)
describe("Block 1 — features/ai-agent/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/ai-agent/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(AI_AGENT_DIR, file))).toBe(false);
    }
  );
});

// ─── Block 2 — REQ-001: zero production imports outside features/ (1α) ────────
// α168 — verifies no runtime consumer references @/features/ai-agent
describe("Block 2 — REQ-001: zero @/features/ai-agent imports in production", () => {
  it("α168: git grep @/features/ai-agent outside features/ai-agent/ returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/ai-agent" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" }
      );
    } catch {
      output = "";
    }
    // Only sentinel/test assertion strings are allowed — not actual import statements
    // Filter out lines that are comments or string literals inside test assertions
    const productionImportLines = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => !line.includes("__tests__"))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes(".test.tsx"))
      .filter((line) => !line.includes(".spec.ts"))
      .filter((line) => !line.includes(".spec.tsx"));

    expect(productionImportLines).toHaveLength(0);
  });
});

// ─── Block 3 — Runtime path coverage [[runtime_path_coverage_red_scope]] (2α) ──
// α169: analyzeDocument consumer imports from modules/ai-agent (NOT features/)
// α170: useAgentQuery consumer imports from modules/ai-agent (NOT features/)
describe("Block 3 — Runtime path coverage: consumers import from modules/ai-agent", () => {
  it("α169: app/api/analyze/route.ts imports analyzeDocument from @/modules/ai-agent/presentation (NOT features/)", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/analyze/route.ts"
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("@/modules/ai-agent/presentation");
    expect(content).not.toContain("@/features/ai-agent");
  });

  it("α170: components/agent/registrar-con-ia/index.tsx imports useAgentQuery from @/modules/ai-agent/presentation/client (NOT features/)", () => {
    const filePath = path.resolve(
      process.cwd(),
      "components/agent/registrar-con-ia/index.tsx"
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("@/modules/ai-agent/presentation/client");
    expect(content).not.toContain("@/features/ai-agent");
  });
});
