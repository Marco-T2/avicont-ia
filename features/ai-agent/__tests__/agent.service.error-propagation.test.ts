/**
 * Audit H #1 — agent.service memoryRepo fire-and-forget error propagation
 *
 * Covers the CRITICAL finding from Audit H (2026-04-24): `agent.service.ts`
 * contains 4 fire-and-forget calls to `memoryRepo.saveMessage(...).catch(
 * err => console.error(...))`. A failed save (DB down, timeout) vanishes into
 * console.error, the turn succeeds from the user's perspective, and the next
 * turn's history is silently corrupt (missing message) — the agent loses
 * conversational context without any alarm.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - User-message save rejects → current code STILL calls Gemini
 *     (because the save is fire-and-forget BEFORE the try/catch).
 *   - Assistant-message save rejects after a successful Gemini call → current
 *     code STILL returns the assistant's text as if the save succeeded.
 *
 * Fix: `await` all four saves, move the user-save into the outer try block so
 * any save failure is caught by the existing `catch (error)` handler that
 * returns the canned "Ocurrió un error..." response. Net effect: failures are
 * surfaced to the user instead of silently corrupting session state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSaveMessage,
  mockGetRecentMessages,
  mockQueryWithTools,
  mockBuildAgentContext,
  mockBuildRagContext,
} = vi.hoisted(() => ({
  mockSaveMessage: vi.fn(),
  mockGetRecentMessages: vi.fn(),
  mockQueryWithTools: vi.fn(),
  mockBuildAgentContext: vi.fn(),
  mockBuildRagContext: vi.fn(),
}));

vi.mock("../memory.repository", () => ({
  ChatMemoryRepository: class {
    saveMessage = mockSaveMessage;
    getRecentMessages = mockGetRecentMessages;
    clearSession = vi.fn();
  },
}));

vi.mock("../gemini.client", () => ({
  queryWithTools: mockQueryWithTools,
}));

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
    mockQueryWithTools.mockResolvedValue({
      text: "Hola, ¿cómo puedo ayudarte?",
      functionCalls: undefined,
    });
  });

  it("happy path: saves user message and assistant message, returns Gemini text", async () => {
    const service = new AgentService();

    const result = await service.query(
      ORG_ID,
      USER_ID,
      "admin",
      "Hola",
      SESSION_ID,
    );

    expect(result.message).toBe("Hola, ¿cómo puedo ayudarte?");
    expect(mockQueryWithTools).toHaveBeenCalledTimes(1);
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

  it("short-circuits when user-message save fails — Gemini must NOT be called", async () => {
    // Pre-fix: saveMessage is fire-and-forget at L86, so this rejection is
    // swallowed by `.catch(console.error)` and Gemini is still called.
    // Post-fix: the await propagates, outer catch returns the canned error,
    // Gemini is never called.
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
    expect(mockQueryWithTools).not.toHaveBeenCalled();
  });

  it("propagates assistant-save failure to canned error instead of returning a falsely-successful response", async () => {
    // Pre-fix: the assistant save at L132 (text-only path) is fire-and-forget;
    // a rejection here is swallowed and the agent returns the Gemini text as
    // if the turn succeeded — but the next turn will be missing this assistant
    // message, silently corrupting conversation history.
    // Post-fix: the await propagates into the outer catch.
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
    expect(mockQueryWithTools).toHaveBeenCalledTimes(1);
  });

  it("does not persist any message when sessionId is absent", async () => {
    const service = new AgentService();

    const result = await service.query(ORG_ID, USER_ID, "admin", "Hola");

    expect(result.message).toBe("Hola, ¿cómo puedo ayudarte?");
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });
});
