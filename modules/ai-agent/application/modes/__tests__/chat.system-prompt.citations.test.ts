/**
 * REQ-31 — Chat-mode system prompt instructs RAG citation format.
 *
 * Appends a single Spanish literal AFTER the REQ-29 FORMATO OBLIGATORIO
 * block and BEFORE `DATOS:`. The EXACT Spanish text is LOCKED per
 * [[textual_rule_verification]] + [[engram_textual_rule_verification]] —
 * any future change requires a new SDD with a RED test mirroring the new
 * text. Coexists with REQ-26 + REQ-29 literals (none replaced) per
 * [[named_rule_immutability]].
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: captured systemPrompt does NOT contain the
 *     REQ-31 literal (current chat.ts:buildSystemPrompt has no citation
 *     instruction line).
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
import type { RagPort } from "../../../domain/ports/rag.port";

const REQ_31_LITERAL =
  "Cuando uses información de un documento (resultado de searchDocuments), citá la fuente así: Según *{documentName}*, sección {sectionPath ?? `chunk ${chunkIndex}`}: …";

// REQ-26 derivative anchor (the FORMATO OBLIGATORIO header). REQ-31 must NOT
// replace it — coexistence per [[named_rule_immutability]].
const REQ_29_ANCHOR =
  "FORMATO OBLIGATORIO para listas de resultados: usá lista markdown con un guión por entrada.";

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
  };
}

beforeEach(() => {
  logSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("REQ-31 — system prompt instructs RAG citation format", () => {
  it("SCN-31.1 α1: systemPrompt contains the EXACT REQ-31 Spanish citation literal", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
    });
    expect(captured.systemPrompt).toBeDefined();
    expect(captured.systemPrompt).toContain(REQ_31_LITERAL);
  });

  it("SCN-31.1 α2: REQ-29 FORMATO OBLIGATORIO literal still present (coexistence, NOT a replacement)", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
    });
    expect(captured.systemPrompt).toContain(REQ_29_ANCHOR);
    expect(captured.systemPrompt).toContain(REQ_31_LITERAL);
  });

  it("SCN-31.1 α3: REQ-31 literal sits AFTER the REQ-29 FORMATO block (ordering invariant)", async () => {
    const captured: { systemPrompt?: string } = {};
    await executeChatMode(makeDeps(captured), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
    });
    const sp = captured.systemPrompt!;
    const idxReq29 = sp.indexOf(REQ_29_ANCHOR);
    const idxReq31 = sp.indexOf(REQ_31_LITERAL);
    expect(idxReq29).toBeGreaterThanOrEqual(0);
    expect(idxReq31).toBeGreaterThan(idxReq29);
  });
});
