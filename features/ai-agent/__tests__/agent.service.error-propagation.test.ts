/**
 * Audit H #1 — agent.service memoryRepo error propagation
 *
 * Covers the CRITICAL finding from Audit H (2026-04-24): saveMessage failures
 * must propagate to the canned error path instead of being silently swallowed.
 * Updated for the LLM wrapper refactor: now mocks `../llm` (the barrel) and
 * `llmClient.query` instead of the legacy `queryWithTools`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSaveMessage,
  mockGetRecentMessages,
  mockLLMQuery,
  mockBuildAgentContext,
  mockBuildRagContext,
} = vi.hoisted(() => ({
  mockSaveMessage: vi.fn(),
  mockGetRecentMessages: vi.fn(),
  mockLLMQuery: vi.fn(),
  mockBuildAgentContext: vi.fn(),
  mockBuildRagContext: vi.fn(),
}));

// Pre-set GEMINI_API_KEY before any module evaluation so the wrapper's
// startup guard (which throws if the key is missing) does not trip when
// vi.importActual loads the real `../llm` barrel.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key-for-vitest";
});

vi.mock("../memory.repository", () => ({
  ChatMemoryRepository: class {
    saveMessage = mockSaveMessage;
    getRecentMessages = mockGetRecentMessages;
    clearSession = vi.fn();
  },
}));

vi.mock("../llm", async () => {
  const actual = await vi.importActual<typeof import("../llm")>("../llm");
  return {
    ...actual,
    llmClient: { query: mockLLMQuery },
  };
});

vi.mock("../agent.context", () => ({
  buildAgentContext: mockBuildAgentContext,
  buildRagContext: mockBuildRagContext,
}));

vi.mock("@/features/farms/server", () => ({
  FarmsService: class {
    list = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/features/lots/server", () => ({
  LotsService: class {
    listByFarm = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/features/pricing/server", () => ({
  PricingService: class {
    calculateLotCost = vi.fn().mockResolvedValue({});
  },
}));

import { AgentService } from "../agent.service";

const ORG_ID = "org_1";
const USER_ID = "user_1";
const SESSION_ID = "session_1";
const CANNED_ERROR_MESSAGE =
  "Ocurrió un error al procesar tu solicitud. Intenta de nuevo.";

describe("AgentService.query — error-handling boundary (Audit H #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecentMessages.mockResolvedValue([]);
    mockBuildAgentContext.mockResolvedValue("context");
    mockBuildRagContext.mockResolvedValue("rag context");
    mockSaveMessage.mockResolvedValue(undefined);
    mockLLMQuery.mockResolvedValue({
      text: "Hola, ¿cómo puedo ayudarte?",
      toolCalls: [],
    });
  });

  it("happy path: saves user message and assistant message, returns LLM text", async () => {
    const service = new AgentService();

    const result = await service.query(
      ORG_ID,
      USER_ID,
      "admin",
      "Hola",
      SESSION_ID,
    );

    expect(result.message).toBe("Hola, ¿cómo puedo ayudarte?");
    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
    expect(mockSaveMessage).toHaveBeenNthCalledWith(
      1,
      SESSION_ID,
      ORG_ID,
      USER_ID,
      "user",
      "Hola",
    );
    expect(mockSaveMessage).toHaveBeenNthCalledWith(
      2,
      SESSION_ID,
      ORG_ID,
      USER_ID,
      "assistant",
      "Hola, ¿cómo puedo ayudarte?",
    );
  });

  it("short-circuits when user-message save fails — LLM must NOT be called", async () => {
    mockSaveMessage.mockRejectedValueOnce(new Error("DB down"));
    const service = new AgentService();

    const result = await service.query(
      ORG_ID,
      USER_ID,
      "admin",
      "Hola",
      SESSION_ID,
    );

    expect(result.message).toBe(CANNED_ERROR_MESSAGE);
    expect(result.suggestion).toBeNull();
    expect(result.requiresConfirmation).toBe(false);
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("propagates assistant-save failure to canned error instead of returning a falsely-successful response", async () => {
    mockSaveMessage
      .mockResolvedValueOnce(undefined) // user save ok
      .mockRejectedValueOnce(new Error("DB down")); // assistant save fails

    const service = new AgentService();
    const result = await service.query(
      ORG_ID,
      USER_ID,
      "admin",
      "Hola",
      SESSION_ID,
    );

    expect(result.message).toBe(CANNED_ERROR_MESSAGE);
    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
  });

  it("does not persist any message when sessionId is absent", async () => {
    const service = new AgentService();

    const result = await service.query(ORG_ID, USER_ID, "admin", "Hola");

    expect(result.message).toBe("Hola, ¿cómo puedo ayudarte?");
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });
});
