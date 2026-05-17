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
 * REQ-29 — System prompt prescribed compact tool-result format (Spanish).
 *
 * Derivative of REQ-26 per [[named_rule_immutability]]: same intent (instruct
 * LLM to format tool-result lists) but with explicit compact format
 * 'DD/MM/YYYY CX-N BsMONTO' so the sidebar stays readable. REQ-26 literal
 * is superseded; this is the active locked string.
 *
 * The EXACT Spanish text is LOCKED per [[textual_rule_verification]] +
 * [[engram_textual_rule_verification]]. Any future change requires a new SDD
 * with a RED test mirroring the new text.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: the literal string is absent from the systemPrompt
 *     captured at the first LLM call.
 */

const EXACT_FORMAT_INSTRUCTION = [
  "FORMATO OBLIGATORIO para listas de resultados: usá lista markdown con un guión por entrada.",
  "Una línea por entry, formato 'DD/MM/YYYY CÓDIGO BsMONTO'.",
  "Moneda SIEMPRE 'Bs' (nunca '$', nunca decimales).",
  "PROHIBIDO: descripciones, estado, etiquetas 'Nº' o 'total', oraciones largas.",
  "",
  "Ejemplos CORRECTOS:",
  "- 16/05/2026 I2605-2 Bs2000",
  "- 16/05/2026 E2605-1 Bs500",
].join("\n");

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

describe("REQ-29 — system prompt prescribed compact tool-result format (supersedes REQ-26)", () => {
  it("SCN-29.1 α1: systemPrompt contains the EXACT locked Spanish compact-format instruction", async () => {
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

  it("SCN-29.1 α2: instruction is present even when moduleHint is null (default)", async () => {
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

  it("SCN-29.1 α3: instruction is present when moduleHint is set (accounting)", async () => {
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
