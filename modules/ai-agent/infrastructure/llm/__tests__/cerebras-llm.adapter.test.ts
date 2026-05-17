import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ConversationTurn } from "../../../domain/types/conversation";
import type { Tool } from "../../../domain/ports/llm-provider.port";
import { LLMQuotaExceededError } from "@/modules/shared/domain/errors";

// vi.hoisted: set CEREBRAS_API_KEY before the adapter module-load env check
// fires. Precedent: gemini-llm.adapter.history.test.ts:7-10.
vi.hoisted(() => {
  process.env.CEREBRAS_API_KEY =
    process.env.CEREBRAS_API_KEY ?? "test-key-for-vitest";
});

// Capture the args passed to chat.completions.create so each test can assert
// the OpenAI-format message shape (system / user / assistant / tool), tool
// declarations, sanitized JSON Schema for tool parameters, and the 429
// quota-exceeded rethrow as LLMQuotaExceededError.
const createSpy = vi.fn();

// Default response — mutable per test. Mirror of gemini-llm.adapter
// `nextResponse` pattern. Cerebras returns OpenAI-shape ChatCompletion
// (see node_modules/@cerebras/cerebras_cloud_sdk/resources/chat/completions.d.ts
// ChatCompletionResponse: choices[0].message.{content,tool_calls}, usage:
// {prompt_tokens, completion_tokens, total_tokens}).
type NextResponse = {
  choices: Array<{
    message: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }> | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

let nextResponse: NextResponse | null = null;

// vi.mock target MUST match the adapter's import path verbatim. Cerebras SDK
// exports the client as default export AND named — adapter uses default import
// `import Cerebras from "@cerebras/cerebras_cloud_sdk"`. Bundled per
// [[mock_hygiene_commit_scope]].
vi.mock("@cerebras/cerebras_cloud_sdk", () => {
  return {
    default: vi.fn().mockImplementation(function (
      this: { chat: { completions: { create: typeof createSpy } } },
    ) {
      this.chat = { completions: { create: createSpy } };
    }),
  };
});

beforeEach(() => {
  createSpy.mockReset();
  createSpy.mockImplementation(async () => {
    return (
      nextResponse ?? {
        choices: [{ message: { content: "", tool_calls: null } }],
        usage: undefined,
      }
    );
  });
  nextResponse = null;
});

async function loadAdapter() {
  // Lazy import so the env mock + vi.mock take effect before module-load.
  const mod = await import("../cerebras-llm.adapter");
  return new mod.CerebrasLLMAdapter();
}

const noTools: readonly Tool[] = [];

describe("CerebrasLLMAdapter — LLMProviderPort contract", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Case 1: Single-shot text query (no history, no tools)
  // Expected failure mode pre-GREEN: ENOENT (cerebras-llm.adapter.ts absent).
  // ──────────────────────────────────────────────────────────────────────────
  it("β1: single-shot query → SDK receives messages=[system, user] and returns text response", async () => {
    nextResponse = {
      choices: [{ message: { content: "hola desde Cerebras", tool_calls: null } }],
      usage: undefined,
    };

    const adapter = await loadAdapter();
    const res = await adapter.query({
      systemPrompt: "Sos un asistente contable.",
      userMessage: "hola mundo",
      tools: noTools,
      // conversationHistory intentionally omitted (backward compat path).
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const arg = createSpy.mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      tools?: unknown;
    };
    // Single-shot path: messages = [system, user]. systemPrompt is injected
    // as a system-role message (Cerebras OpenAI-format requirement).
    expect(arg.messages).toHaveLength(2);
    expect(arg.messages[0]).toEqual({
      role: "system",
      content: "Sos un asistente contable.",
    });
    expect(arg.messages[1]).toEqual({ role: "user", content: "hola mundo" });
    expect(arg.tools).toBeUndefined();
    expect(res.text).toBe("hola desde Cerebras");
    expect(res.toolCalls).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 2: Multi-turn history maps ConversationTurn → OpenAI messages format.
  // Expected failure mode pre-GREEN: ENOENT.
  // ──────────────────────────────────────────────────────────────────────────
  it("β2: history present → maps user/model/tool_result turns to OpenAI messages format", async () => {
    nextResponse = {
      choices: [{ message: { content: "respuesta final", tool_calls: null } }],
    };

    const history: readonly ConversationTurn[] = [
      { kind: "user", content: "consulta inicial" },
      {
        kind: "model",
        content: "",
        toolCalls: [
          { id: "call_abc123", name: "listFarms", input: { limit: 5 } },
        ],
      },
      {
        kind: "tool_result",
        toolCallId: "call_abc123",
        name: "listFarms",
        result: { farms: [{ id: "f1", name: "Granja A" }] },
      },
    ];

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "SYS",
      userMessage: "IGNORED-PER-CONTRACT",
      tools: noTools,
      conversationHistory: history,
    });

    const arg = createSpy.mock.calls[0][0] as {
      messages: Array<{
        role: string;
        content?: string | null;
        tool_call_id?: string;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      }>;
    };

    // System prompt injected as first message; then 3 turns mapped 1:1.
    expect(arg.messages).toHaveLength(4);
    expect(arg.messages[0]).toEqual({ role: "system", content: "SYS" });

    // user turn
    expect(arg.messages[1]).toEqual({
      role: "user",
      content: "consulta inicial",
    });

    // model turn with toolCalls → assistant with tool_calls (content null per
    // OpenAI convention when only tool calls are emitted; arguments must be
    // JSON-stringified per OpenAI SDK contract).
    const assistantMsg = arg.messages[2];
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.content).toBeNull();
    expect(assistantMsg.tool_calls).toEqual([
      {
        id: "call_abc123",
        type: "function",
        function: { name: "listFarms", arguments: JSON.stringify({ limit: 5 }) },
      },
    ]);

    // tool_result turn → tool message with tool_call_id matching prior
    // assistant tool_call. Content is JSON-stringified raw result.
    expect(arg.messages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_abc123",
      content: JSON.stringify({ farms: [{ id: "f1", name: "Granja A" }] }),
    });

    // Per LLMQuery contract (locked at gemini adapter): when history is
    // present, userMessage is IGNORED. Last UserTurn in history IS the new
    // user message.
    const allUserContent = arg.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(allUserContent).not.toContain("IGNORED-PER-CONTRACT");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 3: Function calling — tools non-empty triggers SDK tools + tool_choice.
  // Expected failure mode pre-GREEN: ENOENT.
  // ──────────────────────────────────────────────────────────────────────────
  it("β3: tools non-empty → SDK receives tools[] + tool_choice='auto'; response tool_calls map to ToolCall[]", async () => {
    nextResponse = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_xyz",
                type: "function",
                function: {
                  name: "listSales",
                  arguments: JSON.stringify({ dateFrom: "2026-01-01" }),
                },
              },
            ],
          },
        },
      ],
    };

    const tool: Tool = {
      name: "listSales",
      description: "Lista ventas en un rango de fechas.",
      inputSchema: z.object({ dateFrom: z.string() }),
      resource: "sales",
      action: "read",
    };

    const adapter = await loadAdapter();
    const res = await adapter.query({
      systemPrompt: "SYS",
      userMessage: "lista ventas de enero",
      tools: [tool],
    });

    const arg = createSpy.mock.calls[0][0] as {
      tools?: Array<{
        type: string;
        function: { name: string; description?: string; parameters: object };
      }>;
      tool_choice?: string;
    };
    expect(arg.tool_choice).toBe("auto");
    expect(arg.tools).toHaveLength(1);
    expect(arg.tools?.[0].type).toBe("function");
    expect(arg.tools?.[0].function.name).toBe("listSales");
    expect(arg.tools?.[0].function.description).toBe(
      "Lista ventas en un rango de fechas.",
    );
    // The adapter MUST emit a JSON Schema object for parameters. Exact shape
    // varies by Zod version — assert minimal structural invariants.
    expect(arg.tools?.[0].function.parameters).toMatchObject({
      type: "object",
      properties: { dateFrom: { type: "string" } },
    });

    // Response → ToolCall[] mapped via id passthrough (Cerebras issues stable
    // ids, no synthesizing needed unlike Gemini).
    expect(res.toolCalls).toEqual([
      {
        id: "call_xyz",
        name: "listSales",
        input: { dateFrom: "2026-01-01" },
      },
    ]);
    expect(res.text).toBe("");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 4: Zod sanitization — defensive strip of $schema/additionalProperties
  // even though Cerebras (Llama-class models) generally accepts draft 2020-12.
  // Expected failure mode pre-GREEN: ENOENT.
  // ──────────────────────────────────────────────────────────────────────────
  it("β4: tool parameters sanitized — $schema and additionalProperties stripped (defensive parity with Gemini adapter)", async () => {
    nextResponse = {
      choices: [{ message: { content: "ok", tool_calls: null } }],
    };

    const tool: Tool = {
      name: "noop",
      description: "Just a noop.",
      inputSchema: z.object({ q: z.string() }),
      resource: "sales",
      action: "read",
    };

    const adapter = await loadAdapter();
    await adapter.query({
      systemPrompt: "SYS",
      userMessage: "hola",
      tools: [tool],
    });

    const arg = createSpy.mock.calls[0][0] as {
      tools?: Array<{ function: { parameters: Record<string, unknown> } }>;
    };
    const params = arg.tools?.[0].function.parameters as Record<string, unknown>;
    expect(params).toBeDefined();
    // $schema (draft 2020-12 marker emitted by Zod 4) must NOT travel to the
    // provider. additionalProperties also stripped for parity with Gemini
    // sanitization. This is defensive — Cerebras might accept it, but we
    // keep the transformations consistent across providers so the adapter
    // surface is uniform.
    expect(params).not.toHaveProperty("$schema");
    expect(params).not.toHaveProperty("additionalProperties");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 5: TokenUsage extraction from OpenAI-format usage block.
  // Expected failure mode pre-GREEN: ENOENT.
  // ──────────────────────────────────────────────────────────────────────────
  it("β5: usage block → TokenUsage with input/output/total tokens mapped from OpenAI shape", async () => {
    nextResponse = {
      choices: [{ message: { content: "ok", tool_calls: null } }],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 30,
        total_tokens: 180,
      },
    };

    const adapter = await loadAdapter();
    const res = await adapter.query({
      systemPrompt: "SYS",
      userMessage: "hola",
      tools: noTools,
    });

    expect(res.usage).toEqual({
      inputTokens: 150,
      outputTokens: 30,
      totalTokens: 180,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 6: 429 quota-exceeded → throws LLMQuotaExceededError.
  // Expected failure mode pre-GREEN: ENOENT (adapter file absent).
  // ──────────────────────────────────────────────────────────────────────────
  it("β6: SDK throws 429-shaped error → adapter rethrows as LLMQuotaExceededError", async () => {
    // Cerebras SDK exposes a typed RateLimitError extends APIError<429>. We
    // emulate the runtime shape (message containing markers) — the adapter
    // detects via message substring (mirror of isQuotaExceededError in
    // gemini-llm.adapter, which works defensively across SDK error variants).
    const rateErr = new Error(
      "429 Too Many Requests: rate limit / quota exceeded",
    );
    createSpy.mockRejectedValueOnce(rateErr);

    const adapter = await loadAdapter();
    await expect(
      adapter.query({
        systemPrompt: "SYS",
        userMessage: "hola",
        tools: noTools,
      }),
    ).rejects.toBeInstanceOf(LLMQuotaExceededError);
  });
});
