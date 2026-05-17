import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationTurn } from "../../../domain/types/conversation";
import type { Tool } from "../../../domain/ports/llm-provider.port";

// vi.hoisted: set GEMINI_API_KEY before adapter module-load env check fires.
// Precedent: c3-presentation-shape.poc-ai-agent-hex.test.ts:7-10.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

// Capture the args passed to generateContent so each test can assert the
// dual-mode behavior of the adapter (history vs single-shot) AND the precise
// shape of the Gemini Content[] mapping (ToolResultTurn → FunctionResponsePart
// with role="user" and object-wrapped primitives).
const generateContentSpy = vi.fn();
let nextResponse: {
  text?: () => string;
  functionCalls?: () => unknown;
  usageMetadata?: unknown;
} | null = null;

vi.mock("@google/generative-ai", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
    this.getGenerativeModel = vi.fn().mockReturnValue({
      generateContent: generateContentSpy,
    });
  }),
}));

beforeEach(() => {
  generateContentSpy.mockReset();
  generateContentSpy.mockImplementation(async () => ({
    response: nextResponse ?? {
      text: () => "",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    },
  }));
  nextResponse = null;
});

async function loadAdapter() {
  // Lazy import so the env mock + vi.mock take effect before module-load.
  const mod = await import("../gemini-llm.adapter");
  return new mod.GeminiLLMAdapter();
}

const noTools: readonly Tool[] = [];

describe("REQ-22 — Gemini adapter dual-mode (history vs single-shot)", () => {
  it("α1: empty history → single-shot path passes userMessage as string (backward compat)", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "hola mundo",
      tools: noTools,
      // conversationHistory intentionally omitted
    });

    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    // Single-shot path: arg 0 is the raw user string (preserves the pre-REQ-21
    // behavior at adapter line 128 — `generateContent(userMessage)`).
    expect(generateContentSpy.mock.calls[0][0]).toBe("hola mundo");
  });

  it("α2: history present → IGNORES userMessage; uses last UserTurn", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "PRIMER MENSAJE" },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "ESTE-DEBE-SER-IGNORADO",
      tools: noTools,
      conversationHistory: history,
    });

    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    const arg = generateContentSpy.mock.calls[0][0] as {
      contents: Array<{ role: string; parts: Array<{ text?: string }> }>;
    };
    // Multi-turn path: arg 0 is { contents: Content[] } NOT a bare string.
    expect(arg).toHaveProperty("contents");
    expect(arg.contents).toHaveLength(1);
    expect(arg.contents[0].role).toBe("user");
    expect(arg.contents[0].parts[0].text).toBe("PRIMER MENSAJE");
    // userMessage is NEVER inserted as a trailing turn — caller-contract:
    // the new user msg MUST already be the last UserTurn in history.
    const allText = arg.contents.flatMap((c) =>
      c.parts.map((p) => p.text ?? ""),
    );
    expect(allText).not.toContain("ESTE-DEBE-SER-IGNORADO");
  });

  it("α3: ToolResultTurn maps to { role: 'user', parts: [{ functionResponse: { name, response } }] }", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "consulta" },
      {
        kind: "model",
        content: "",
        toolCalls: [{ id: "gem_1_0", name: "listFarms", input: {} }],
      },
      {
        kind: "tool_result",
        toolCallId: "gem_1_0",
        name: "listFarms",
        result: { farms: [{ id: "f1", name: "Granja A" }] },
      },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "ignored",
      tools: noTools,
      conversationHistory: history,
    });

    const arg = generateContentSpy.mock.calls[0][0] as {
      contents: Array<{
        role: string;
        parts: Array<{
          text?: string;
          functionResponse?: { name: string; response: object };
          functionCall?: { name: string; args: object };
        }>;
      }>;
    };
    expect(arg.contents).toHaveLength(3);
    const toolResultContent = arg.contents[2];
    // Gemini SDK quirk: FunctionResponsePart MUST be wrapped in Content with
    // role="user" — verified in node_modules/@google/generative-ai/dist/generative-ai.d.ts
    // (FunctionResponsePart documentation).
    expect(toolResultContent.role).toBe("user");
    expect(toolResultContent.parts).toHaveLength(1);
    expect(toolResultContent.parts[0].functionResponse).toEqual({
      name: "listFarms",
      response: { farms: [{ id: "f1", name: "Granja A" }] },
    });
  });

  it("α4: primitive result wrapped → { value: <primitive> } (FunctionResponse.response is `object`)", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "q" },
      {
        kind: "tool_result",
        toolCallId: "id-1",
        name: "someTool",
        result: "raw-string-primitive",
      },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "ignored",
      tools: noTools,
      conversationHistory: history,
    });

    const arg = generateContentSpy.mock.calls[0][0] as {
      contents: Array<{
        role: string;
        parts: Array<{
          functionResponse?: { name: string; response: { value?: unknown } };
        }>;
      }>;
    };
    const part = arg.contents[1].parts[0];
    expect(part.functionResponse).toBeDefined();
    expect(part.functionResponse?.response).toEqual({
      value: "raw-string-primitive",
    });
  });

  it("α5: ModelTurn with toolCalls maps to { role: 'model', parts: [{ functionCall: { name, args } }] }", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "consulta" },
      {
        kind: "model",
        content: "",
        toolCalls: [
          { id: "id-1", name: "listSales", input: { dateFrom: "2026-01-01" } },
        ],
      },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "ignored",
      tools: noTools,
      conversationHistory: history,
    });

    const arg = generateContentSpy.mock.calls[0][0] as {
      contents: Array<{
        role: string;
        parts: Array<{
          functionCall?: { name: string; args: object };
          text?: string;
        }>;
      }>;
    };
    const modelContent = arg.contents[1];
    expect(modelContent.role).toBe("model");
    // Empty text — no text part emitted, only the functionCall part.
    const fcPart = modelContent.parts.find((p) => p.functionCall);
    expect(fcPart?.functionCall).toEqual({
      name: "listSales",
      args: { dateFrom: "2026-01-01" },
    });
  });

  it("α6: per-call usage is returned (loop sums; adapter does NOT accumulate)", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 20,
        totalTokenCount: 120,
      },
    };

    const adapter = await loadAdapter();
    const res = await adapter.query({
      systemPrompt: "sys",
      userMessage: "hola",
      tools: noTools,
    });

    expect(res.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
    });
  });

  it("α7: tool_result with `null` result wraps into `{ value: null }` (defensive object-wrap)", async () => {
    nextResponse = {
      text: () => "ok",
      functionCalls: () => undefined,
      usageMetadata: undefined,
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "q" },
      {
        kind: "tool_result",
        toolCallId: "id-1",
        name: "someTool",
        result: null,
      },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "sys",
      userMessage: "ignored",
      tools: noTools,
      conversationHistory: history,
    });

    const arg = generateContentSpy.mock.calls[0][0] as {
      contents: Array<{
        parts: Array<{
          functionResponse?: { response: { value?: unknown } };
        }>;
      }>;
    };
    expect(arg.contents[1].parts[0].functionResponse?.response).toEqual({
      value: null,
    });
  });
});
