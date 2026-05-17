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
 * C4..C7 — Multi-turn LLM loop tests (REQ-19, REQ-23, REQ-24, REQ-27).
 *
 * Strategy: in-memory fakes — same convention as
 * `chat-mode-surface-threading.surface-separation.test.ts`. `vi.mock` only on
 * `@/lib/logging/structured` to capture telemetry. `llmProvider.query` is a
 * `vi.fn` driven by `mockResolvedValueOnce(...)` chains so each test scripts
 * the exact multi-turn LLM behavior.
 */

const logSpy = vi.fn();
vi.mock("@/lib/logging/structured", () => ({
  logStructured: (entry: Record<string, unknown>) => logSpy(entry),
}));

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
const accountingQueryStub = {
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
};

function makeDeps(llmQuery: (args: LLMQuery) => Promise<LLMResponse>) {
  const llmProvider: LLMProviderPort = { query: llmQuery };
  return {
    llmProvider,
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

beforeEach(() => {
  logSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── SCN-19.1 single-tool happy path ──────────────────────────────────────────

describe("SCN-19.1 — single-tool happy path (turn 1 tool_call, turn 2 text)", () => {
  it("loop returns final LLM text (NOT the 'Aquí están los datos solicitados.' placeholder)", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "call-1", name: "listRecentJournalEntries", input: { limit: 5 } },
        ],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      })
      .mockResolvedValueOnce({
        text: "El asiento más reciente es 'Asiento de prueba' del 2026-05-01.",
        toolCalls: [],
        usage: { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "mostrame el último asiento",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(res.message).toBe(
      "El asiento más reciente es 'Asiento de prueba' del 2026-05-01.",
    );
    expect(res.message).not.toBe("Aquí están los datos solicitados.");
    expect(res.requiresConfirmation).toBe(false);
  });

  it("turn 2 LLM call carries conversation history with ToolResultTurn", async () => {
    let secondCallArgs: LLMQuery | undefined;
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockImplementationOnce(async () => ({
        text: "",
        toolCalls: [
          { id: "call-1", name: "listRecentJournalEntries", input: { limit: 5 } },
        ],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      }))
      .mockImplementationOnce(async (args) => {
        secondCallArgs = args;
        return {
          text: "Listo.",
          toolCalls: [],
          usage: { inputTokens: 200, outputTokens: 5, totalTokens: 205 },
        };
      });

    await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "mostrame el último asiento",
      surface: "sidebar-qa",
    });

    expect(secondCallArgs?.conversationHistory).toBeDefined();
    const history = secondCallArgs!.conversationHistory!;
    // Expect: [user, model+toolCalls, tool_result] minimum.
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history[0].kind).toBe("user");
    expect(history[1].kind).toBe("model");
    expect(history[2].kind).toBe("tool_result");
    const toolResult = history[2] as Extract<
      (typeof history)[number],
      { kind: "tool_result" }
    >;
    expect(toolResult.name).toBe("listRecentJournalEntries");
  });
});

// ── SCN-19.2 multi-tool single turn (S-03 fix) ──────────────────────────────

describe("SCN-19.2 — multi-tool single turn (S-03 fix: both tools execute)", () => {
  it("BOTH tools execute when turn 1 returns 2 tool_calls — no multiple_tool_calls_dropped event", async () => {
    let secondCallArgs: LLMQuery | undefined;
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockImplementationOnce(async () => ({
        text: "",
        toolCalls: [
          { id: "c1", name: "listSales", input: {} },
          { id: "c2", name: "listPurchases", input: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      }))
      .mockImplementationOnce(async (args) => {
        secondCallArgs = args;
        return {
          text: "Ventas: 1 registro. Compras: 1 registro.",
          toolCalls: [],
          usage: { inputTokens: 250, outputTokens: 20, totalTokens: 270 },
        };
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "ventas y compras del mes",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(res.message).toBe("Ventas: 1 registro. Compras: 1 registro.");

    // Turn-2 history MUST carry BOTH tool_result turns — S-03 fix.
    const history = secondCallArgs!.conversationHistory!;
    const toolResults = history.filter((t) => t.kind === "tool_result");
    expect(toolResults).toHaveLength(2);
    expect(toolResults.map((t) => (t as { name: string }).name)).toEqual([
      "listSales",
      "listPurchases",
    ]);

    // Legacy `multiple_tool_calls_dropped` warning is GONE — the loop handles
    // N tools naturally.
    const dropped = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((e) => e.event === "multiple_tool_calls_dropped");
    expect(dropped).toHaveLength(0);
  });
});

// ── SCN-19.3 multi-turn sequential (tool → tool → text) ─────────────────────

describe("SCN-19.3 — multi-turn sequential (3 LLM calls)", () => {
  it("loop continues across 3 turns when the model emits sequential tool_calls", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [{ id: "c1", name: "listSales", input: {} }],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      })
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [{ id: "c2", name: "listPurchases", input: {} }],
        usage: { inputTokens: 200, outputTokens: 10, totalTokens: 210 },
      })
      .mockResolvedValueOnce({
        text: "Resumen consolidado.",
        toolCalls: [],
        usage: { inputTokens: 300, outputTokens: 30, totalTokens: 330 },
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "dame un resumen",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(res.message).toBe("Resumen consolidado.");
  });
});

// ── SCN-23.1 max-turn cap fires ────────────────────────────────────────────

describe("SCN-23.1 — max-turn cap fires when LLM never stops calling tools", () => {
  it("loop stops at turn 5 and returns the locked fallback message + chat_max_turns_reached warn", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValue({
        text: "",
        toolCalls: [{ id: "loop", name: "listSales", input: {} }],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "loop forever",
      surface: "sidebar-qa",
    });

    // Cap = MAX_CHAT_TURNS = 5 LLM calls.
    expect(queryFn).toHaveBeenCalledTimes(5);
    expect(res.message).toBe(
      "No pude completar la consulta. Intentá ser más específico.",
    );

    const warns = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((e) => e.event === "chat_max_turns_reached");
    expect(warns).toHaveLength(1);
    expect(warns[0].turnCount).toBe(5);
    expect(warns[0].level).toBe("warn");
  });
});

// ── SCN-27.1 tool error mid-loop ────────────────────────────────────────────

describe("SCN-27.1 — tool error mid-loop surfaces gracefully via LLM", () => {
  it("tool throws → error appended as { error: msg } → loop continues → LLM phrases final message", async () => {
    let secondCallArgs: LLMQuery | undefined;

    // Override accountingQuery.listSales to throw.
    const failingAccountingQuery = {
      ...accountingQueryStub,
      listSales: async () => {
        throw new Error("DB down");
      },
    };

    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockImplementationOnce(async () => ({
        text: "",
        toolCalls: [{ id: "c-err", name: "listSales", input: {} }],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      }))
      .mockImplementationOnce(async (args) => {
        secondCallArgs = args;
        return {
          text: "Hubo un error al consultar las ventas. Intentá más tarde.",
          toolCalls: [],
          usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220 },
        };
      });

    const deps = makeDeps(queryFn);
    deps.accountingQuery = failingAccountingQuery;

    const res = await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "vendí algo?",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(res.message).toBe(
      "Hubo un error al consultar las ventas. Intentá más tarde.",
    );

    // Loop appended a ToolResultTurn with the error envelope so the model can
    // see it and phrase a graceful reply.
    const history = secondCallArgs!.conversationHistory!;
    const toolResult = history.find((t) => t.kind === "tool_result") as
      | { kind: "tool_result"; result: unknown }
      | undefined;
    expect(toolResult).toBeDefined();
    expect(toolResult!.result).toEqual({ error: "DB down" });
  });
});

// ── SCN-24.1 telemetry aggregation ──────────────────────────────────────────

describe("SCN-24.1 — telemetry aggregates tokens across turns + adds turnCount", () => {
  it("agent_invocation event sums tokens across 2 turns and includes turnCount = 2", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "call-1", name: "listRecentJournalEntries", input: {} },
        ],
        usage: { inputTokens: 1000, outputTokens: 10, totalTokens: 1010 },
      })
      .mockResolvedValueOnce({
        text: "Resultado final.",
        toolCalls: [],
        usage: { inputTokens: 1200, outputTokens: 80, totalTokens: 1280 },
      });

    await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "asientos",
      surface: "sidebar-qa",
    });

    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation).toBeDefined();
    expect(invocation?.inputTokens).toBe(2200);
    expect(invocation?.outputTokens).toBe(90);
    expect(invocation?.totalTokens).toBe(2290);
    expect(invocation?.turnCount).toBe(2);
    expect(invocation?.toolCallsCount).toBe(1);
    expect(invocation?.toolNames).toEqual(["listRecentJournalEntries"]);
  });
});

// ── SCN-24.2 multi-tool telemetry across turns ─────────────────────────────

describe("SCN-24.2 — multi-tool telemetry: toolCallsCount spans ALL turns", () => {
  it("S-03 path: 2 tool_calls in turn 1 → toolCallsCount = 2, toolNames lists both", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "c1", name: "listSales", input: {} },
          { id: "c2", name: "listPurchases", input: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      })
      .mockResolvedValueOnce({
        text: "Resumen.",
        toolCalls: [],
        usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220 },
      });

    await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "ventas y compras",
      surface: "sidebar-qa",
    });

    const invocation = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e.event === "agent_invocation");
    expect(invocation?.toolCallsCount).toBe(2);
    expect(invocation?.toolNames).toEqual(["listSales", "listPurchases"]);
    expect(invocation?.turnCount).toBe(2);
  });
});

// ── SCN-25.1 searchDocuments bypass ─────────────────────────────────────────

describe("SCN-25.1 — searchDocuments retains turn-1 single-call bypass", () => {
  it("searchDocuments tool_call at turn 1 (sole call) → 1 LLM call total, NO 2nd call", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "rag-1", name: "searchDocuments", input: { query: "manual" } },
        ],
        usage: { inputTokens: 100, outputTokens: 5, totalTokens: 105 },
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "member",
      prompt: "buscame en el manual",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    // RAG returns "" (empty rag) → falls back to "No se encontraron documentos relevantes."
    expect(res.message).toBe("No se encontraron documentos relevantes.");
    expect(res.suggestion).toBeNull();

    const warns = logSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((e) => e.event === "chat_max_turns_reached");
    expect(warns).toHaveLength(0);
  });
});

// ── SCN-10.x chatMemory append contract ─────────────────────────────────────

describe("chatMemory append contract — only initial user + final model text", () => {
  it("multi-turn invocation: append() called exactly 2× (initial user + final model)", async () => {
    const appendSpy = vi.fn().mockResolvedValue(undefined);
    const chatMemory: ChatMemoryPort = {
      findRecent: async () => [],
      append: appendSpy,
    };

    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "c1", name: "listRecentJournalEntries", input: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      })
      .mockResolvedValueOnce({
        text: "Listo.",
        toolCalls: [],
        usage: { inputTokens: 200, outputTokens: 5, totalTokens: 205 },
      });

    const deps = makeDeps(queryFn);
    deps.chatMemory = chatMemory;

    await executeChatMode(deps, {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "consulta",
      surface: "sidebar-qa",
      sessionId: "session-123",
    });

    expect(appendSpy).toHaveBeenCalledTimes(2);
    // First call: user prompt.
    expect(appendSpy.mock.calls[0][3]).toEqual({
      role: "user",
      content: "consulta",
    });
    // Second call: final model message (NOT per-turn intermediate text).
    expect(appendSpy.mock.calls[1][3]).toEqual({
      role: "model",
      content: "Listo.",
    });
  });
});

// ── Backward compat: text-only single-turn (no tool calls) ──────────────────

describe("Backward compat — text-only response (no tool_call) stays single-turn", () => {
  it("LLM returns text-only on turn 1 → loop short-circuits, 1 LLM call total", async () => {
    const queryFn = vi
      .fn<(args: LLMQuery) => Promise<LLMResponse>>()
      .mockResolvedValueOnce({
        text: "Respuesta directa sin herramientas.",
        toolCalls: [],
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      });

    const res = await executeChatMode(makeDeps(queryFn), {
      orgId: "org",
      userId: "u",
      role: "owner",
      prompt: "hola",
      surface: "sidebar-qa",
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(res.message).toBe("Respuesta directa sin herramientas.");
  });
});
