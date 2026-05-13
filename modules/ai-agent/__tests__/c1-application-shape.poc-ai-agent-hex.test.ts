import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC ai-agent-hex migration.
 * Paired sister: modules/dispatch/__tests__/c1-application-shape.poc-dispatch-hex.test.ts
 *
 * Strategy: existsSync guards inside each it() block — application files do NOT
 * exist pre-GREEN (ENOENT at top-level import would crash the file).
 * See [[red_acceptance_failure_mode]] — expected failure mode: ENOENT /
 * "Cannot find module '@/modules/ai-agent/application/...'" (file absent).
 *
 * REQ mapping:
 * - Block 1: AgentService zero-arg factory + port injection (REQ-005)
 * - Block 2: AgentRateLimitService (REQ-003)
 * - Block 3: Mode functions (REQ-005 — LLMProviderPort injected, not singleton)
 * - Block 4: Tool executors (REQ-004 — AccountsLookupPort injected, not PrismaAccountsRepo)
 * - Block 5: Pricing sub-aggregate (REQ-003)
 * - Block 6: LLM singleton elimination — REQ-005 NEGATIVE
 * - Block 7: REQ-002 NEGATIVE (application layer free of server-only / use-client)
 * - Block 8: REQ-004 NEGATIVE (no @/features/ai-agent imports in application layer)
 * - Block 9: Functional smoke with in-memory fakes
 */

const ROOT = path.resolve(__dirname, "../../..");
const APPLICATION = path.join(ROOT, "modules/ai-agent/application");

function appFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

/**
 * Require an application module and assert the given named export exists.
 * Throws if the file does not exist (ENOENT) — expected RED failure mode.
 */
function requireAppExport(relative: string, exportName: string): unknown {
  const filePath = appFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot find module '@/modules/ai-agent/application/${relative}'`);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path.resolve(filePath));
  return mod[exportName];
}

function readAppFile(relative: string): string {
  const filePath = appFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot read '@/modules/ai-agent/application/${relative}'`);
  }
  return fs.readFileSync(filePath, "utf8");
}

// ── In-memory fakes for compile-time shape verification (dispatch C1 sister pattern) ──

import type { LLMProviderPort } from "../domain/ports/llm-provider.port";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port";
import type { AgentRateLimitPort } from "../domain/ports/agent-rate-limit.port";
import type { AccountsLookupPort } from "../domain/ports/accounts-lookup.port";
import type { RagPort } from "../domain/ports/rag.port";

function makeInMemoryLLMProvider(): LLMProviderPort {
  return {
    query: async () => ({ text: "", toolCalls: [], usage: undefined }),
  };
}

function makeInMemoryChatMemory(): ChatMemoryPort {
  return {
    findRecent: async () => [],
    append: async () => {},
  };
}

function makeInMemoryAgentContextReader(): AgentContextReaderPort {
  return {
    findMemberIdByUserId: async () => null,
    findFarmsWithActiveLots: async () => [],
    findRecentExpenses: async () => [],
    countJournalEntries: async () => 0,
  };
}

function makeInMemoryRateLimitPort(): AgentRateLimitPort {
  return {
    check: async () => ({ allowed: true }),
    record: async () => {},
  };
}

function makeInMemoryAccountsLookup(): AccountsLookupPort {
  return {
    findManyByIds: async () => [],
    findByType: async () => [],
    findDetailChildrenByParentCodes: async () => [],
  };
}

function makeInMemoryRag(): RagPort {
  return {
    search: async () => [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — AgentService zero-arg factory + port injection (REQ-005)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC ai-agent-hex C1 — application layer shape", () => {
  describe("Block 1 — AgentService + AgentServiceDeps (REQ-005: LLMProviderPort injected)", () => {
    it("α39: AgentService class is exported from application/agent.service", () => {
      const AgentService = requireAppExport("agent.service.ts", "AgentService");
      expect(AgentService).toBeDefined();
      expect(typeof AgentService).toBe("function");
    });

    it("α40: AgentService instantiates with all port deps (in-memory fakes)", () => {
      const AgentService = requireAppExport("agent.service.ts", "AgentService") as new (deps: unknown) => unknown;
      const fakeDeps = {
        llmProvider: makeInMemoryLLMProvider(),
        chatMemory: makeInMemoryChatMemory(),
        contextReader: makeInMemoryAgentContextReader(),
        rateLimit: { check: async () => ({ allowed: true }), record: async () => {} },
        accountsLookup: makeInMemoryAccountsLookup(),
        rag: makeInMemoryRag(),
        farmInquiry: { findById: async () => null, findAllWithActiveLots: async () => [] },
        lotInquiry: { findById: async () => null },
        pricingService: { calculateLotCost: async () => ({}) },
      };
      const service = new AgentService(fakeDeps);
      expect(service).toBeInstanceOf(AgentService as new (deps: unknown) => unknown);
    });

    it("α41: AgentService has query method", () => {
      const AgentService = requireAppExport("agent.service.ts", "AgentService") as new (deps: unknown) => Record<string, unknown>;
      const fakeDeps = {
        llmProvider: makeInMemoryLLMProvider(),
        chatMemory: makeInMemoryChatMemory(),
        contextReader: makeInMemoryAgentContextReader(),
        rateLimit: { check: async () => ({ allowed: true }), record: async () => {} },
        accountsLookup: makeInMemoryAccountsLookup(),
        rag: makeInMemoryRag(),
        farmInquiry: { findById: async () => null, findAllWithActiveLots: async () => [] },
        lotInquiry: { findById: async () => null },
        pricingService: { calculateLotCost: async () => ({}) },
      };
      const service = new AgentService(fakeDeps);
      expect(typeof service["query"]).toBe("function");
    });

    it("α42: AgentService has analyzeBalanceSheet method", () => {
      const AgentService = requireAppExport("agent.service.ts", "AgentService") as new (deps: unknown) => Record<string, unknown>;
      const fakeDeps = {
        llmProvider: makeInMemoryLLMProvider(),
        chatMemory: makeInMemoryChatMemory(),
        contextReader: makeInMemoryAgentContextReader(),
        rateLimit: { check: async () => ({ allowed: true }), record: async () => {} },
        accountsLookup: makeInMemoryAccountsLookup(),
        rag: makeInMemoryRag(),
        farmInquiry: { findById: async () => null, findAllWithActiveLots: async () => [] },
        lotInquiry: { findById: async () => null },
        pricingService: { calculateLotCost: async () => ({}) },
      };
      const service = new AgentService(fakeDeps);
      expect(typeof service["analyzeBalanceSheet"]).toBe("function");
    });

    it("α43: AgentService has analyzeIncomeStatement method", () => {
      const AgentService = requireAppExport("agent.service.ts", "AgentService") as new (deps: unknown) => Record<string, unknown>;
      const fakeDeps = {
        llmProvider: makeInMemoryLLMProvider(),
        chatMemory: makeInMemoryChatMemory(),
        contextReader: makeInMemoryAgentContextReader(),
        rateLimit: { check: async () => ({ allowed: true }), record: async () => {} },
        accountsLookup: makeInMemoryAccountsLookup(),
        rag: makeInMemoryRag(),
        farmInquiry: { findById: async () => null, findAllWithActiveLots: async () => [] },
        lotInquiry: { findById: async () => null },
        pricingService: { calculateLotCost: async () => ({}) },
      };
      const service = new AgentService(fakeDeps);
      expect(typeof service["analyzeIncomeStatement"]).toBe("function");
    });

    it("α44: AgentServiceDeps type is exported from application/agent.service (compile-time: field llmProvider accepts LLMProviderPort)", () => {
      // Structural: AgentServiceDeps must be exported. The in-memory fake above
      // satisfies its shape at the call site — this test asserts the export exists.
      const content = readAppFile("agent.service.ts");
      expect(content).toMatch(/export\s+(?:type\s+|interface\s+)AgentServiceDeps/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 2 — AgentRateLimitService (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 2 — AgentRateLimitService (REQ-003)", () => {
    it("α45: AgentRateLimitService class is exported from application/rate-limit.service", () => {
      const AgentRateLimitService = requireAppExport("rate-limit.service.ts", "AgentRateLimitService");
      expect(AgentRateLimitService).toBeDefined();
      expect(typeof AgentRateLimitService).toBe("function");
    });

    it("α46: AgentRateLimitService accepts AgentRateLimitPort dep (rateLimitPort field in content)", () => {
      const content = readAppFile("rate-limit.service.ts");
      // AgentRateLimitService must NOT instantiate a repo directly — it must accept a port
      expect(content).not.toMatch(/new\s+AgentRateLimitRepository\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 3 — Mode functions (REQ-005: LLMProvider via deps, not singleton)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Mode functions (REQ-005: LLMProviderPort injected)", () => {
    it("α47: executeChatMode is a function exported from application/modes/chat", () => {
      const executeChatMode = requireAppExport("modes/chat.ts", "executeChatMode");
      expect(typeof executeChatMode).toBe("function");
    });

    it("α48: executeBalanceSheetAnalysis is a function exported from application/modes/balance-sheet-analysis", () => {
      const fn = requireAppExport("modes/balance-sheet-analysis.ts", "executeBalanceSheetAnalysis");
      expect(typeof fn).toBe("function");
    });

    it("α49: executeIncomeStatementAnalysis is a function exported from application/modes/income-statement-analysis", () => {
      const fn = requireAppExport("modes/income-statement-analysis.ts", "executeIncomeStatementAnalysis");
      expect(typeof fn).toBe("function");
    });

    it("α50: executeJournalEntryAiMode is a function exported from application/modes/journal-entry-ai", () => {
      const fn = requireAppExport("modes/journal-entry-ai.ts", "executeJournalEntryAiMode");
      expect(typeof fn).toBe("function");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 4 — Tool executors (REQ-004: AccountsLookupPort injected)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Tool executors (REQ-004: AccountsLookupPort injected, not PrismaAccountsRepo)", () => {
    it("α51: executeFindAccountsByPurpose is a function exported from application/tools/find-accounts", () => {
      const fn = requireAppExport("tools/find-accounts.ts", "executeFindAccountsByPurpose");
      expect(typeof fn).toBe("function");
    });

    it("α52: executeFindContact is a function exported from application/tools/find-contact", () => {
      const fn = requireAppExport("tools/find-contact.ts", "executeFindContact");
      expect(typeof fn).toBe("function");
    });

    it("α53: executeParseAccountingOperation is a function exported from application/tools/parse-operation", () => {
      const fn = requireAppExport("tools/parse-operation.ts", "executeParseAccountingOperation");
      expect(typeof fn).toBe("function");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 5 — Pricing sub-aggregate (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Pricing sub-aggregate (REQ-003)", () => {
    it("α54: PricingService class is exported from application/pricing/pricing.service", () => {
      const PricingService = requireAppExport("pricing/pricing.service.ts", "PricingService");
      expect(PricingService).toBeDefined();
      expect(typeof PricingService).toBe("function");
    });

    it("α55: PricingService has calculateLotCost method", () => {
      const PricingService = requireAppExport("pricing/pricing.service.ts", "PricingService") as new (...args: unknown[]) => Record<string, unknown>;
      const service = new PricingService();
      expect(typeof service["calculateLotCost"]).toBe("function");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 6 — LLM singleton elimination (REQ-005 NEGATIVE)
  // application/modes/* must NOT import llmClient singleton
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 6 — LLM singleton elimination (REQ-005 NEGATIVE: no llmClient import in app layer)", () => {
    const LLM_SINGLETON_RE = /import\s+\{[^}]*\bllmClient\b[^}]*\}/m;
    const GEMINI_ADAPTER_IMPORT_RE = /import.*GeminiLLMAdapter/m;
    const OLD_LLM_MODULE_RE = /from\s+["'][^"']*\/llm(?:\/index)?["']/m;

    it("α56: application/modes/chat does NOT import llmClient singleton", () => {
      const content = readAppFile("modes/chat.ts");
      expect(content).not.toMatch(LLM_SINGLETON_RE);
    });

    it("α57: application/modes/balance-sheet-analysis does NOT import llmClient singleton", () => {
      const content = readAppFile("modes/balance-sheet-analysis.ts");
      expect(content).not.toMatch(LLM_SINGLETON_RE);
    });

    it("α58: application/modes/income-statement-analysis does NOT import llmClient singleton", () => {
      const content = readAppFile("modes/income-statement-analysis.ts");
      expect(content).not.toMatch(LLM_SINGLETON_RE);
    });

    it("α59: application/modes/journal-entry-ai does NOT import llmClient singleton", () => {
      const content = readAppFile("modes/journal-entry-ai.ts");
      expect(content).not.toMatch(LLM_SINGLETON_RE);
    });

    it("α60: application/agent.service does NOT import GeminiLLMAdapter directly (only via LLMProviderPort)", () => {
      const content = readAppFile("agent.service.ts");
      expect(content).not.toMatch(GEMINI_ADAPTER_IMPORT_RE);
    });

    it("α61: application/agent.service does NOT import from old llm module (singleton source)", () => {
      // The old llmClient singleton came from '../llm' or '../llm/index'
      // Application layer must NOT reference this — only domain/ports/llm-provider.port
      const content = readAppFile("agent.service.ts");
      expect(content).not.toMatch(OLD_LLM_MODULE_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 7 — REQ-002 NEGATIVE: application layer free of server-only / use-client
  // Application is environment-neutral by R5 (REQ-003 + REQ-002 negative)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 7 — REQ-002 NEGATIVE: application files free of server-only / use-client", () => {
    const SERVER_ONLY_RE = /import\s+["']server-only["']/m;
    const USE_CLIENT_RE = /["']use client["']/m;

    it("α62: application/agent.service does NOT contain 'server-only' or 'use client'", () => {
      const content = readAppFile("agent.service.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α63: application/modes/chat does NOT contain 'server-only' or 'use client'", () => {
      const content = readAppFile("modes/chat.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });

    it("α64: application/modes/journal-entry-ai does NOT contain 'server-only' or 'use client'", () => {
      const content = readAppFile("modes/journal-entry-ai.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
      expect(content).not.toMatch(USE_CLIENT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 8 — REQ-004 NEGATIVE: no @/features/ai-agent imports in application layer
  // Application must import from domain/ports, not from legacy features path
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 8 — REQ-004 NEGATIVE: application layer free of @/features/ai-agent imports", () => {
    const LEGACY_FEATURES_RE = /from\s+["']@\/features\/ai-agent/m;

    it("α65: application/agent.service does NOT import from @/features/ai-agent", () => {
      const content = readAppFile("agent.service.ts");
      expect(content).not.toMatch(LEGACY_FEATURES_RE);
    });

    it("α66: application/tools/find-accounts does NOT import PrismaAccountsRepo directly", () => {
      const content = readAppFile("tools/find-accounts.ts");
      expect(content).not.toMatch(/from\s+["']@\/modules\/accounting\/infrastructure/m);
    });

    it("α67: application/tools/parse-operation does NOT import PrismaAccountsRepo directly", () => {
      const content = readAppFile("tools/parse-operation.ts");
      expect(content).not.toMatch(/from\s+["']@\/modules\/accounting\/infrastructure/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Block 9 — Functional smoke with in-memory fakes
  // Declares expected failure: if mode uses real DB calls with fake deps,
  // the smoke may throw. Declaration below per [[red_acceptance_failure_mode]].
  // ─────────────────────────────────────────────────────────────────────────

  describe("Block 9 — Functional smoke (in-memory fakes, AgentResponse shape)", () => {
    it("α68: AgentService.query resolves to an object with message field from fake deps", async () => {
      /**
       * Expected failure modes at RED (application files absent):
       * 1. ENOENT on application/agent.service.ts — PRIMARY expected failure
       * 2. If file exists but deps are incomplete — TypeError from missing method
       * 3. If mode makes real DB calls with fake deps — infra error (acceptable GREEN-phase concern)
       *
       * At GREEN: fake deps must be sufficient for the smoke to resolve.
       * The mode implementations receive llmProvider via deps — fake returns empty text.
       * AgentResponse must have at least { message: string }.
       */
      const AgentService = requireAppExport("agent.service.ts", "AgentService") as new (deps: unknown) => {
        query: (...args: unknown[]) => Promise<Record<string, unknown>>;
      };

      const fakeDeps = {
        llmProvider: makeInMemoryLLMProvider(),
        chatMemory: makeInMemoryChatMemory(),
        contextReader: makeInMemoryAgentContextReader(),
        rateLimit: { check: async () => ({ allowed: true }), record: async () => {} },
        accountsLookup: makeInMemoryAccountsLookup(),
        rag: makeInMemoryRag(),
        farmInquiry: { findById: async () => null, findAllWithActiveLots: async () => [] },
        lotInquiry: { findById: async () => null },
        pricingService: { calculateLotCost: async () => ({}) },
      };

      const service = new AgentService(fakeDeps);
      const result = await service.query("org-1", "user-1", "admin", "hello", undefined, "chat");
      // AgentResponse must have at least a message field
      expect(result).toHaveProperty("message");
    });
  });
});
