import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for POC ai-agent-hex migration.
 * Paired sister: modules/dispatch/__tests__/c0-domain-shape.poc-dispatch-hex.test.ts
 *
 * Strategy: existsSync guards inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT at top-level import would crash the file).
 * See [[red_acceptance_failure_mode]] — expected failure mode: ENOENT /
 * "Cannot find module '@/modules/ai-agent/domain/...'" (file absent).
 *
 * REQ mapping:
 * - Block 1: LLM types (REQ-005)
 * - Block 2: Agent types (REQ-003)
 * - Block 3: Validation (REQ-003)
 * - Block 4: Agent utils (REQ-003)
 * - Block 5: Prompts pure functions (REQ-006)
 * - Block 6: Ports (REQ-005, REQ-003)
 * - Block 7: Pricing sub-aggregate domain (REQ-003)
 * - Block 8: Errors (REQ-003)
 * - Block 9: REQ-002 NEGATIVE (server-only marker discipline)
 * - Block 10: REQ-003 NEGATIVE (R5 absoluta domain layer)
 */

const ROOT = path.resolve(__dirname, "../../..");
const DOMAIN = path.join(ROOT, "modules/ai-agent/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

/**
 * Require a domain module and assert the given named export exists.
 * Throws if the file does not exist (ENOENT) — that is the expected RED
 * failure mode for all import-shape tests in this cycle.
 */
function requireDomainExport(relative: string, exportName: string): unknown {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot find module '@/modules/ai-agent/domain/${relative}'`);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path.resolve(filePath));
  return mod[exportName];
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot read '@/modules/ai-agent/domain/${relative}'`);
  }
  return fs.readFileSync(filePath, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — LLM types (REQ-005)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC ai-agent-hex C0 — domain layer shape", () => {
  describe("Block 1 — LLM types (REQ-005: LLMProviderPort separated from adapter)", () => {
    it("α1: LLMQuery type is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+type\s+LLMQuery/m);
    });

    it("α2: LLMResponse type is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+type\s+LLMResponse/m);
    });

    it("α3: ToolCall type is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+type\s+ToolCall/m);
    });

    it("α4: TokenUsage type is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+type\s+TokenUsage/m);
    });

    it("α5: LLMProviderPort interface is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+interface\s+LLMProviderPort/m);
    });

    it("α6: defineTool is a function exported from domain/ports/llm-provider.port", () => {
      const defineTool = requireDomainExport("ports/llm-provider.port.ts", "defineTool");
      expect(typeof defineTool).toBe("function");
    });

    it("α7: Tool type is exported from domain/ports/llm-provider.port", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).toMatch(/export\s+type\s+Tool/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 2 — Agent types (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Agent types (REQ-003: domain layer R5 absoluta)", () => {
    it("α8: AgentSuggestion discriminated union is exported from domain/types/agent.types", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).toMatch(/export\s+type\s+AgentSuggestion/m);
    });

    it("α9: AgentResponse is exported from domain/types/agent.types", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).toMatch(/export\s+(?:type\s+|interface\s+)AgentResponse/m);
    });

    it("α10: CreateJournalEntrySuggestion is exported from domain/types/agent.types", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).toMatch(/export\s+(?:type\s+|interface\s+)CreateJournalEntrySuggestion/m);
    });

    it("α11: AnalyzeBalanceSheetResponse is exported from domain/types/agent.types", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).toMatch(/export\s+type\s+AnalyzeBalanceSheetResponse/m);
    });

    it("α12: AnalyzeIncomeStatementResponse is exported from domain/types/agent.types", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).toMatch(/export\s+type\s+AnalyzeIncomeStatementResponse/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 3 — Validation (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Validation (REQ-003: pure Zod schemas in domain)", () => {
    it("α13: agentQuerySchema parses a valid chat query", () => {
      const agentQuerySchema = requireDomainExport("validation/agent.validation.ts", "agentQuerySchema") as {
        safeParse: (data: unknown) => { success: boolean };
      };
      // surface is REQUIRED after agent-surface-separation (spec REQ-2, D2).
      const result = agentQuerySchema.safeParse({
        prompt: "test",
        mode: "chat",
        surface: "sidebar-qa",
      });
      expect(result.success).toBe(true);
    });

    it("α14: agentQuerySchema rejects empty prompt", () => {
      const agentQuerySchema = requireDomainExport("validation/agent.validation.ts", "agentQuerySchema") as {
        safeParse: (data: unknown) => { success: boolean };
      };
      const result = agentQuerySchema.safeParse({ prompt: "" });
      expect(result.success).toBe(false);
    });

    it("α15: AGENT_MODES includes 'chat' and 'journal-entry-ai'", () => {
      const AGENT_MODES = requireDomainExport("validation/agent.validation.ts", "AGENT_MODES") as readonly string[];
      expect(AGENT_MODES).toContain("chat");
      expect(AGENT_MODES).toContain("journal-entry-ai");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 4 — Agent utils (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Agent utils (REQ-003: pure helpers in domain)", () => {
    it("α16: normalizeRole is a pure function from domain/agent-utils", () => {
      const normalizeRole = requireDomainExport("agent-utils.ts", "normalizeRole");
      expect(typeof normalizeRole).toBe("function");
    });

    it("α17: normalizeRole maps 'admin' to a non-empty string", () => {
      const normalizeRole = requireDomainExport("agent-utils.ts", "normalizeRole") as (role: string) => string;
      const result = normalizeRole("admin");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 5 — Prompts pure functions (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Prompts pure functions (REQ-006: no IO, no server deps)", () => {
    it("α18: balance-sheet-analysis.prompt exports a builder function", () => {
      const content = readDomainFile("prompts/balance-sheet-analysis.prompt.ts");
      expect(content).toMatch(/export\s+function\s+\w+/m);
    });

    it("α19: income-statement-analysis.prompt exports a builder function", () => {
      const content = readDomainFile("prompts/income-statement-analysis.prompt.ts");
      expect(content).toMatch(/export\s+function\s+\w+/m);
    });

    it("α20: journal-entry-ai.prompt exports a builder function", () => {
      const content = readDomainFile("prompts/journal-entry-ai.prompt.ts");
      expect(content).toMatch(/export\s+function\s+\w+/m);
    });

    it("α21: TrivialityCode type is exported from balance-sheet-analysis.prompt", () => {
      const content = readDomainFile("prompts/balance-sheet-analysis.prompt.ts");
      expect(content).toMatch(/export\s+type\s+TrivialityCode/m);
    });

    it("α22: IncomeStatementTrivialityCode type is exported from income-statement-analysis.prompt", () => {
      const content = readDomainFile("prompts/income-statement-analysis.prompt.ts");
      expect(content).toMatch(/export\s+type\s+IncomeStatementTrivialityCode/m);
    });

    it("α23: JournalEntryAiContextHints type is exported from journal-entry-ai.prompt", () => {
      const content = readDomainFile("prompts/journal-entry-ai.prompt.ts");
      expect(content).toMatch(/export\s+interface\s+JournalEntryAiContextHints/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 6 — Ports (REQ-005, REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 6 — Ports (REQ-005: LLMProviderPort; REQ-003: port interfaces in domain)", () => {
    it("α24: ChatMemoryPort interface is exported from domain/ports/chat-memory.port", () => {
      const content = readDomainFile("ports/chat-memory.port.ts");
      expect(content).toMatch(/export\s+interface\s+ChatMemoryPort/m);
    });

    it("α25: AgentContextPort interface is exported from domain/ports/agent-context-reader.port", () => {
      const content = readDomainFile("ports/agent-context-reader.port.ts");
      expect(content).toMatch(/export\s+interface\s+\w+(?:Context(?:Reader)?|AgentContext)\w*Port/m);
    });

    it("α26: RateLimitPort interface is exported from domain/ports/agent-rate-limit.port", () => {
      const content = readDomainFile("ports/agent-rate-limit.port.ts");
      expect(content).toMatch(/export\s+interface\s+\w+(?:RateLimit)\w*Port/m);
    });

    it("α27: AccountsLookupPort interface is exported from domain/ports/accounts-lookup.port", () => {
      const content = readDomainFile("ports/accounts-lookup.port.ts");
      expect(content).toMatch(/export\s+interface\s+\w*AccountsLookup\w*Port/m);
    });

    it("α28: RagPort interface is exported from domain/ports/rag.port", () => {
      const content = readDomainFile("ports/rag.port.ts");
      expect(content).toMatch(/export\s+interface\s+\w*Rag\w*Port/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 7 — Pricing sub-aggregate domain (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 7 — Pricing sub-aggregate domain (REQ-003)", () => {
    it("α29: LotPricingResult type is exported from domain/pricing/pricing.types", () => {
      const content = readDomainFile("pricing/pricing.types.ts");
      expect(content).toMatch(/export\s+(?:type\s+|interface\s+)LotPricingResult/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 8 — Errors (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 8 — Errors (REQ-003: domain error types)", () => {
    it("α30: domain/errors/agent-errors file exists and exports at least one symbol", () => {
      const content = readDomainFile("errors/agent-errors.ts");
      expect(content).toMatch(/export\s/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 9 — REQ-002 NEGATIVE (server-only marker discipline)
  // Domain files MUST NOT contain `import "server-only"` or `"use client"`
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 9 — REQ-002 NEGATIVE: domain files free of server-only / use-client", () => {
    const SERVER_ONLY_RE = /import\s+["']server-only["']/m;
    const USE_CLIENT_RE = /["']use client["']/m;

    it("α31: domain/types/agent.types does NOT contain 'server-only' import", () => {
      const content = readDomainFile("types/agent.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α32: domain/validation/agent.validation does NOT contain 'server-only' import", () => {
      const content = readDomainFile("validation/agent.validation.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α33: domain/ports/llm-provider.port does NOT contain 'server-only' import", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α34: domain/prompts/balance-sheet-analysis.prompt does NOT contain 'server-only' import (REQ-006)", () => {
      const content = readDomainFile("prompts/balance-sheet-analysis.prompt.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α35: domain/prompts/income-statement-analysis.prompt does NOT contain 'server-only' import (REQ-006)", () => {
      const content = readDomainFile("prompts/income-statement-analysis.prompt.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α36: domain/prompts/journal-entry-ai.prompt does NOT contain 'server-only' import (REQ-006)", () => {
      const content = readDomainFile("prompts/journal-entry-ai.prompt.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 10 — REQ-003 NEGATIVE (R5 absoluta domain layer)
  // Domain layer MUST NOT import infra deps (@google/generative-ai, Prisma, etc.)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 10 — REQ-003 NEGATIVE: domain layer R5 absoluta (no infra deps)", () => {
    it("α37: domain/ports/llm-provider.port does NOT import @google/generative-ai", () => {
      const content = readDomainFile("ports/llm-provider.port.ts");
      expect(content).not.toMatch(/from\s+["']@google\/generative-ai["']/m);
    });

    it("α38: domain/prompts/* do NOT import from @/modules/**/infrastructure/**", () => {
      const INFRA_IMPORT_RE = /from\s+["']@\/modules\/[^"']+\/infrastructure/m;
      const PRISMA_IMPORT_RE = /from\s+["']@(?:\/generated\/prisma|prisma\/client)["']/m;
      const GOOGLE_AI_RE = /from\s+["']@google\/generative-ai["']/m;

      const promptFiles = [
        "prompts/balance-sheet-analysis.prompt.ts",
        "prompts/income-statement-analysis.prompt.ts",
        "prompts/journal-entry-ai.prompt.ts",
      ];

      for (const file of promptFiles) {
        const content = readDomainFile(file);
        expect(content, `${file} must not import infra`).not.toMatch(INFRA_IMPORT_RE);
        expect(content, `${file} must not import Prisma`).not.toMatch(PRISMA_IMPORT_RE);
        expect(content, `${file} must not import @google/generative-ai`).not.toMatch(GOOGLE_AI_RE);
      }
    });
  });
});
