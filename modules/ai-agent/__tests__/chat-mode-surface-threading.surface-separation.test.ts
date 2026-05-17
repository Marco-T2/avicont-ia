import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type {
  LLMProviderPort,
  Tool,
} from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";

// REQ-4 + REQ-6 — executeChatMode threads `surface: Surface` through
// ChatModeArgs, uses getToolsForSurface (not getToolsForRole), and the
// finally-block agent_invocation telemetry includes the surface field.
//
// Strategy: in-memory fakes (NO vi.mock — c1-application-shape precedent).
// vi.mock only on @/lib/logging/structured to spy logStructured calls.

// ── In-memory fakes ─────────────────────────────────────────────────────────

function makeLLMProviderCapturingTools(
  capture: { tools?: readonly Tool[] } = {},
): LLMProviderPort {
  return {
    query: async ({ tools }) => {
      capture.tools = tools;
      return {
        text: "respuesta",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
  };
}

function makeChatMemory(): ChatMemoryPort {
  return {
    findRecent: async () => [],
    append: async () => {},
  };
}

function makeContextReader(): AgentContextReaderPort {
  return {
    findMemberIdByUserId: async () => null,
    findFarmsWithActiveLots: async () => [],
    findRecentExpenses: async () => [],
    countJournalEntries: async () => 0,
  };
}

function makeRag(): RagPort {
  return { search: async () => [] };
}

const noopInquiry = {
  list: async () => [],
  // PricingService has calculateLotCost
};

const pricingFake = {
  calculateLotCost: async () => ({}),
};

// Spy on logStructured by mocking the module.
const logSpy = vi.fn();
vi.mock("@/lib/logging/structured", () => ({
  logStructured: (entry: Record<string, unknown>) => logSpy(entry),
}));

beforeEach(() => {
  logSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SCN-4.1: chat mode honors surface gate (sidebar-qa × member → 4 tools)", () => {
  it("LLM receives [searchDocuments, getLotSummary, listFarms, listLots] for sidebar-qa × member (post-cleanup #2026-05-17)", async () => {
    const captured: { tools?: readonly Tool[] } = {};
    const deps = {
      llmProvider: makeLLMProviderCapturingTools(captured),
      chatMemory: makeChatMemory(),
      contextReader: makeContextReader(),
      rag: makeRag(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      farmInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lotInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pricingService: pricingFake as any,
    };
    await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "member",
      prompt: "qué dice el manual",
      surface: "sidebar-qa",
    });
    const names = (captured.tools ?? []).map((t) => t.name);
    expect(names.sort()).toEqual(
      ["searchDocuments", "getLotSummary", "listFarms", "listLots"].sort(),
    );
  });
});

describe("SCN-4.2: chat mode no_tools path triggered by surface×role with empty resolver result", () => {
  it("unknown role on any chat surface returns no_tools_for_role message", async () => {
    const deps = {
      llmProvider: makeLLMProviderCapturingTools(),
      chatMemory: makeChatMemory(),
      contextReader: makeContextReader(),
      rag: makeRag(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      farmInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lotInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pricingService: pricingFake as any,
    };
    const result = await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "unknown-custom-role",
      prompt: "hola",
      surface: "modal-registrar",
    });
    expect(result.message).toBe(
      "No tienes herramientas disponibles para tu rol actual.",
    );
    expect(result.suggestion).toBeNull();
    expect(result.requiresConfirmation).toBe(false);
  });
});

describe("SCN-6.1: logStructured agent_invocation includes surface field", () => {
  it("payload contains surface: 'sidebar-qa' on chat path", async () => {
    const deps = {
      llmProvider: makeLLMProviderCapturingTools(),
      chatMemory: makeChatMemory(),
      contextReader: makeContextReader(),
      rag: makeRag(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      farmInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lotInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pricingService: pricingFake as any,
    };
    await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "member",
      prompt: "hola",
      surface: "sidebar-qa",
    });

    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation).toBeDefined();
    expect(invocation?.surface).toBe("sidebar-qa");
  });
});

describe("SCN-6.2: surface appears in telemetry on error path too", () => {
  it("payload contains surface even when LLM throws", async () => {
    const throwingProvider: LLMProviderPort = {
      query: async () => {
        throw new Error("LLM down");
      },
    };
    const deps = {
      llmProvider: throwingProvider,
      chatMemory: makeChatMemory(),
      contextReader: makeContextReader(),
      rag: makeRag(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      farmInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lotInquiry: noopInquiry as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pricingService: pricingFake as any,
    };
    await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "admin",
      prompt: "boom",
      surface: "modal-registrar",
    });

    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation).toBeDefined();
    expect(invocation?.surface).toBe("modal-registrar");
    expect(invocation?.outcome).toBe("error");
  });
});
