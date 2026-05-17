import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentService } from "../application/agent.service.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";

// REQ-3 (design D3.1 + D3.3) — AgentService.query MUST accept a moduleHint
// argument and thread it into the executeChatMode args object. The chat
// module is mocked via vi.mock so we can capture the args object directly.
//
// Strategy: spy on executeChatMode by mocking ../application/modes/chat.ts,
// stub the rest of AgentServiceDeps with in-memory fakes (c1-application-
// shape precedent).
//
// SIGNATURE NOTE: agent-sidebar-module-hint applies moduleHint as the 9th
// positional argument of AgentService.query (after contextHints) to avoid
// shifting existing positional assertions in F1 sister tests.

const executeChatModeSpy = vi.fn();

vi.mock("../application/modes/chat.ts", () => ({
  executeChatMode: (deps: unknown, args: unknown) => {
    executeChatModeSpy(deps, args);
    return Promise.resolve({
      message: "ok",
      suggestion: null,
      requiresConfirmation: false,
    });
  },
}));

function makeDeps() {
  const llmProvider: LLMProviderPort = {
    query: async () => ({
      text: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    }),
  };
  const chatMemory: ChatMemoryPort = {
    findRecent: async () => [],
    append: async () => {},
  };
  const contextReader: AgentContextReaderPort = {
    findMemberIdByUserId: async () => null,
    findFarmsWithActiveLots: async () => [],
    findRecentExpenses: async () => [],
    countJournalEntries: async () => 0,
  };
  const rag: RagPort = { search: async () => [] };
  const accountsLookup = {
    findManyByIds: async () => [],
    findByType: async () => [],
    findDetailChildrenByParentCodes: async () => [],
  };
  const rateLimit = {
    check: async () => ({ allowed: true as const }),
  };
  const noopInquiry = { list: async () => [] };
  const pricingFake = { calculateLotCost: async () => ({}) };
  return {
    llmProvider,
    chatMemory,
    contextReader,
    rateLimit,
    accountsLookup,
    rag,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    farmInquiry: noopInquiry as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lotInquiry: noopInquiry as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pricingService: pricingFake as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  executeChatModeSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SCN-4.1: AgentService.query threads moduleHint='accounting' to executeChatMode", () => {
  it("captured args object contains moduleHint: 'accounting'", async () => {
    const svc = new AgentService(makeDeps());
    // Positional signature (post-SDD):
    // (orgId, userId, role, prompt, sessionId, surface, mode, contextHints, moduleHint)
    await svc.query(
      "org-1",
      "user-1",
      "member",
      "hola",
      undefined,
      "sidebar-qa",
      "chat",
      undefined,
      "accounting",
    );
    expect(executeChatModeSpy).toHaveBeenCalledTimes(1);
    const args = executeChatModeSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(args.moduleHint).toBe("accounting");
  });
});

describe("SCN-4.2: AgentService.query threads moduleHint='farm' to executeChatMode", () => {
  it("captured args object contains moduleHint: 'farm'", async () => {
    const svc = new AgentService(makeDeps());
    await svc.query(
      "org-1",
      "user-1",
      "member",
      "hola",
      undefined,
      "sidebar-qa",
      "chat",
      undefined,
      "farm",
    );
    expect(executeChatModeSpy).toHaveBeenCalledTimes(1);
    const args = executeChatModeSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(args.moduleHint).toBe("farm");
  });
});

describe("SCN-4.3: AgentService.query threads moduleHint=null to executeChatMode", () => {
  it("captured args object contains moduleHint: null (explicit)", async () => {
    const svc = new AgentService(makeDeps());
    await svc.query(
      "org-1",
      "user-1",
      "member",
      "hola",
      undefined,
      "sidebar-qa",
      "chat",
      undefined,
      null,
    );
    expect(executeChatModeSpy).toHaveBeenCalledTimes(1);
    const args = executeChatModeSpy.mock.calls[0][1] as Record<string, unknown>;
    expect("moduleHint" in args).toBe(true);
    expect(args.moduleHint).toBeNull();
  });
});
