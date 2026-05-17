import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type {
  LLMProviderPort,
} from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";

// REQ-4 + REQ-5 + REQ-6 (design D4, D5, D6.5+D6.6 merged) —
// executeChatMode MUST:
//   1. Append the EXACT Spanish "Contexto del usuario..." paragraph to the
//      system prompt when args.moduleHint is "accounting" or "farm".
//   2. Omit the paragraph entirely when moduleHint is null.
//   3. Emit moduleHint in the logStructured agent_invocation payload.
//
// The Spanish text is LOCKED verbatim in design D4.2 per
// [[textual_rule_verification]]; any change requires a new SDD with a new RED.

// ── Fakes ──────────────────────────────────────────────────────────────────

const llmCalls: Array<{ systemPrompt: string }> = [];

function makeLLMProvider(): LLMProviderPort {
  return {
    query: async ({ systemPrompt }) => {
      llmCalls.push({ systemPrompt });
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

const noopInquiry = { list: async () => [] };
const pricingFake = { calculateLotCost: async () => ({}) };
// F2 — accountingQuery is a required ChatModeDeps field as of REQ-16. These
// prompt-augmentation tests never trigger a tool call, so a noop stub is enough.
const accountingQueryStub = {
  listRecentJournalEntries: async () => [],
  getAccountMovements: async () => [],
  getAccountBalance: async () => ({ accountId: "", balance: "0.00", asOf: null }),
  listSales: async () => [],
  listPurchases: async () => [],
  listPayments: async () => [],
};

const logSpy = vi.fn();
vi.mock("@/lib/logging/structured", () => ({
  logStructured: (entry: Record<string, unknown>) => logSpy(entry),
}));

beforeEach(() => {
  logSpy.mockClear();
  llmCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

function deps() {
  return {
    llmProvider: makeLLMProvider(),
    chatMemory: makeChatMemory(),
    contextReader: makeContextReader(),
    rag: makeRag(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    farmInquiry: noopInquiry as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lotInquiry: noopInquiry as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pricingService: pricingFake as any,
    accountingQuery: accountingQueryStub,
  };
}

// ── Prompt augmentation tests ──────────────────────────────────────────────

const EXACT_ACCOUNTING =
  "Contexto del usuario: el usuario está actualmente en la sección de Contabilidad. Cuando elijas herramientas, priorizá las que sean relevantes a este módulo. No fuerces el dominio si la pregunta es explícitamente de otra área.";

const EXACT_FARM =
  "Contexto del usuario: el usuario está actualmente en la sección de Granja. Cuando elijas herramientas, priorizá las que sean relevantes a este módulo. No fuerces el dominio si la pregunta es explícitamente de otra área.";

const PROMPT_PREFIX = "Contexto del usuario: el usuario está actualmente en la sección de";

describe("SCN-5.1: chat mode prompt augmentation — moduleHint='accounting' adds EXACT Spanish paragraph", () => {
  it("systemPrompt contains the locked Contabilidad paragraph (D4.2)", async () => {
    await executeChatMode(deps(), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: "accounting",
    });
    expect(llmCalls.length).toBeGreaterThan(0);
    expect(llmCalls[0].systemPrompt).toContain(EXACT_ACCOUNTING);
  });
});

describe("SCN-5.2: chat mode prompt augmentation — moduleHint='farm' adds EXACT Granja paragraph", () => {
  it("systemPrompt contains the locked Granja paragraph (D4.2)", async () => {
    await executeChatMode(deps(), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: "farm",
    });
    expect(llmCalls.length).toBeGreaterThan(0);
    expect(llmCalls[0].systemPrompt).toContain(EXACT_FARM);
  });
});

describe("SCN-5.3: chat mode prompt augmentation — moduleHint=null omits the paragraph", () => {
  it("systemPrompt does NOT contain the 'Contexto del usuario' prefix", async () => {
    await executeChatMode(deps(), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: null,
    });
    expect(llmCalls.length).toBeGreaterThan(0);
    expect(llmCalls[0].systemPrompt).not.toContain(PROMPT_PREFIX);
  });
});

// ── Telemetry tests ─────────────────────────────────────────────────────────

describe("SCN-6.1: logStructured agent_invocation includes moduleHint when set", () => {
  it("payload contains moduleHint: 'accounting'", async () => {
    await executeChatMode(deps(), {
      orgId: "org",
      userId: "u",
      role: "member",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: "accounting",
    });
    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation).toBeDefined();
    expect(invocation?.moduleHint).toBe("accounting");
  });
});

describe("SCN-6.2: logStructured agent_invocation emits explicit moduleHint=null", () => {
  it("payload contains moduleHint key with value null (NOT undefined / missing)", async () => {
    await executeChatMode(deps(), {
      orgId: "org",
      userId: "u",
      role: "member",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: null,
    });
    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation).toBeDefined();
    expect(invocation && "moduleHint" in invocation).toBe(true);
    expect(invocation?.moduleHint).toBeNull();
  });
});
