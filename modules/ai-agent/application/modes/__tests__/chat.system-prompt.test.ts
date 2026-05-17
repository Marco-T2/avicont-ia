import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../chat";
import type { AgentContextReaderPort } from "../../../domain/ports/agent-context-reader.port";
import type { ChatMemoryPort } from "../../../domain/ports/chat-memory.port";
import type {
  LLMProviderPort,
  LLMQuery,
  LLMResponse,
} from "../../../domain/ports/llm-provider.port";
import type { RagPort } from "../../../domain/ports/rag.port";

/**
 * C8 RED — System prompt addition for tool-result formatting (REQ-26).
 *
 * The EXACT Spanish string is LOCKED per design D-26 +
 * [[textual_rule_verification]] / [[engram_textual_rule_verification]]. Any
 * future change requires a new SDD with a RED test mirroring the new text.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: the literal string is absent from the systemPrompt
 *     captured at the first LLM call.
 */

const EXACT_FORMAT_INSTRUCTION =
  "Cuando recibas resultados de herramientas, presenta los datos al usuario en español natural y conciso.";

const logSpy = vi.fn();
vi.mock("@/lib/logging/structured", () => ({
  logStructured: (entry: Record<string, unknown>) => logSpy(entry),
}));

function makeDeps(captured: { systemPrompt?: string }) {
  const llmProvider: LLMProviderPort = {
    query: async (args: LLMQuery): Promise<LLMResponse> => {
      captured.systemPrompt = args.systemPrompt;
      return {
        text: "respuesta",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noopInquiry: any = { list: async () => [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricingFake: any = { calculateLotCost: async () => ({}) };
  return {
    llmProvider,
    chatMemory,
    contextReader,
    rag,
    farmInquiry: noopInquiry,
    lotInquiry: noopInquiry,
    pricingService: pricingFake,
    accountingQuery: {
      listRecentJournalEntries: async () => [],
      getAccountMovements: async () => [],
      getAccountBalance: async () => ({
        accountId: "",
        balance: "0.00",
        asOf: null,
      }),
      listSales: async () => [],
      listPurchases: async () => [],
      listPayments: async () => [],
    },
  };
}

beforeEach(() => {
  logSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("REQ-26 — system prompt instructs LLM to format tool results (Spanish)", () => {
  it("SCN-26.1 α1: systemPrompt contains the EXACT locked Spanish instruction", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
    });
    expect(captured.systemPrompt).toBeDefined();
    expect(captured.systemPrompt).toContain(EXACT_FORMAT_INSTRUCTION);
  });

  it("SCN-26.1 α2: instruction is present even when moduleHint is null (default)", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: null,
    });
    expect(captured.systemPrompt).toContain(EXACT_FORMAT_INSTRUCTION);
  });

  it("SCN-26.1 α3: instruction is present when moduleHint is set (accounting)", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
      moduleHint: "accounting",
    });
    expect(captured.systemPrompt).toContain(EXACT_FORMAT_INSTRUCTION);
  });
});
