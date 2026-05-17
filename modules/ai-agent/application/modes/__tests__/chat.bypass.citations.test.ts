/**
 * α-citation-coherence sentinel — REQ-25 bypass + LLM-loop both emit
 * citation tokens (REQ-32 SCN-32.2).
 *
 * The REQ-25 searchDocuments bypass returns `buildRagContext` text directly
 * (no second LLM call). The LLM-loop path embeds the same text in the
 * system context and the LLM is instructed (REQ-31) to cite using the
 * `Según *{documentName}*, sección {…}` literal pattern. This α-sentinel
 * locks the coherence: bypass output MUST contain at least one citation
 * token matching either format.
 *
 * Disjunction regex per spec SCN-32.2:
 *   `/Según \*[^*]+\*, sección /`  OR  `/\[[^#]+#[^\]]+\]/`
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: bypass message emits raw snippets without the
 *     `[name#section]` marker (pre-C1.3 formatter behavior).
 *
 * Coexistence with REQ-25 (bypass invariant): bypass still skips the
 * second LLM call; only the formatted text gained citation markers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../chat";
import type { AgentContextReaderPort } from "../../../domain/ports/agent-context-reader.port";
import type { ChatMemoryPort } from "../../../domain/ports/chat-memory.port";
import type {
  LLMProviderPort,
  LLMQuery,
  LLMResponse,
} from "../../../domain/ports/llm-provider.port";
import type { RagPort, RagResult } from "../../../domain/ports/rag.port";

const CITATION_DISJUNCTION = /Según \*[^*]+\*, sección |\[[^#]+#[^\]]+\]/;

const logSpy = vi.fn();
vi.mock("@/lib/logging/structured", () => ({
  logStructured: (entry: Record<string, unknown>) => logSpy(entry),
}));

function makeRagWith(results: RagResult[]): RagPort {
  return { search: async () => results };
}

function makeDeps(rag: RagPort, llm: LLMProviderPort) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noopInquiry: any = { list: async () => [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricingFake: any = { calculateLotCost: async () => ({}) };
  return {
    llmProvider: llm,
    chatMemory,
    contextReader,
    rag,
    farmInquiry: noopInquiry,
    lotInquiry: noopInquiry,
    pricingService: pricingFake,
  };
}

beforeEach(() => logSpy.mockClear());
afterEach(() => vi.clearAllMocks());

describe("α-citation-coherence — REQ-25 bypass emits citation tokens (REQ-32 SCN-32.2)", () => {
  it("α1: bypass path output contains the `[name#section]` token", async () => {
    const ragResults: RagResult[] = [
      {
        content: "El IVA crédito fiscal se registra en la cuenta 1.01.05.",
        score: 0.95,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 0,
          sectionPath: null,
        },
      },
    ];

    // LLM responds at turn 1 with a single searchDocuments tool_call (no
    // text) — triggers REQ-25 bypass. `result.text` is empty so the
    // bypass falls back to the buildRagContext text (which carries the
    // citation token from C1.3).
    const llmProvider: LLMProviderPort = {
      query: async (_args: LLMQuery): Promise<LLMResponse> => ({
        text: "",
        toolCalls: [
          {
            id: "call-1",
            name: "searchDocuments",
            input: { query: "iva" },
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    };

    const res = await executeChatMode(
      makeDeps(makeRagWith(ragResults), llmProvider),
      {
        orgId: "org",
        userId: "u",
        role: "owner",
        prompt: "¿qué cuenta es para IVA?",
        surface: "sidebar-qa",
      },
    );

    expect(res.message).toMatch(CITATION_DISJUNCTION);
    // Explicit token format (the bypass path emits the bracket variant).
    expect(res.message).toContain("[Plan de Cuentas#chunk 0]");
  });

  it("α2: bypass with sectionPath present uses sectionPath in the token", async () => {
    const ragResults: RagResult[] = [
      {
        content: "Sección de activos circulantes.",
        score: 0.9,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 4,
          sectionPath: "Capítulo 1 > Activos",
        },
      },
    ];

    const llmProvider: LLMProviderPort = {
      query: async (): Promise<LLMResponse> => ({
        text: "",
        toolCalls: [
          {
            id: "call-1",
            name: "searchDocuments",
            input: { query: "activos" },
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    };

    const res = await executeChatMode(
      makeDeps(makeRagWith(ragResults), llmProvider),
      {
        orgId: "org",
        userId: "u",
        role: "owner",
        prompt: "activos",
        surface: "sidebar-qa",
      },
    );

    expect(res.message).toMatch(CITATION_DISJUNCTION);
    expect(res.message).toContain("[Plan de Cuentas#Capítulo 1 > Activos]");
  });
});
