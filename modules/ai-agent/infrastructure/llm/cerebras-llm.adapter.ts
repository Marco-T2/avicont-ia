import "server-only";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { z } from "zod";
import { logStructured } from "@/lib/logging/structured";
import { LLMQuotaExceededError } from "@/modules/shared/domain/errors";
import type {
  LLMProviderPort,
  LLMQuery,
  LLMResponse,
  TokenUsage,
  Tool,
  ToolCall,
} from "../../domain/ports/llm-provider.port";
import type { ConversationTurn } from "../../domain/types/conversation";

/**
 * CerebrasLLMAdapter — implements LLMProviderPort over the Cerebras Cloud
 * SDK (OpenAI-compatible chat.completions surface). Paired sister:
 * `gemini-llm.adapter.ts` — same dual-mode dispatch (single-shot vs
 * conversationHistory), same defensive Zod-to-JSON-Schema sanitization,
 * same 429 → LLMQuotaExceededError rethrow, same logStructured pattern.
 *
 * Provider-specific differences from Gemini:
 *  - Message format is OpenAI-flat (`{role, content}` / `{role, tool_calls}`
 *    / `{role: "tool", tool_call_id, content}`) instead of Gemini's
 *    `Content { role, parts: [{ text | functionCall | functionResponse }] }`.
 *  - Tool call ids are stable provider-issued (`call_*`) — no synthesizing
 *    via `gem_<ts>_<i>` like Gemini.
 *  - System prompt is injected as the first message with `role: "system"`
 *    instead of Gemini's separate `systemInstruction` field.
 *  - Usage shape is OpenAI flat (`prompt_tokens`/`completion_tokens`/
 *    `total_tokens`) instead of Gemini's `promptTokenCount`/etc.
 */

/**
 * Detects whether an error thrown by the Cerebras SDK represents a 429 rate
 * limit / quota exceeded response. The SDK exposes a typed `RateLimitError`
 * subclass with `status: 429`, but we also keep defensive string-marker
 * matching for the case where a raw HTTP error bubbles through with a
 * message containing the relevant markers. Mirrors Gemini's
 * isQuotaExceededError shape so both adapters have a uniform 429 detection
 * surface.
 */
function isQuotaExceededError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const statusFromTypedError = (err as { status?: number }).status;
  if (statusFromTypedError === 429) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("resource_exhausted")
  );
}

const apiKey = process.env.CEREBRAS_API_KEY;
if (!apiKey) {
  throw new Error(
    "La API KEY de CEREBRAS no está configurada en las variables de entorno",
  );
}

const cerebras = new Cerebras({ apiKey });

// Production-tier open-weight model from OpenAI hosted on Cerebras. Chosen
// for native function-calling support and 65k context window. Stable model
// id on Cerebras' production tier — distinct from preview-tier llama3.x ids.
const MODEL_ID = "gpt-oss-120b";

// Determinístico para tareas contables (REQ-21 chat-mode loop). Mirror of
// Gemini adapter's default — keeps both providers comparable at the prompt
// engineering layer.
const TEMPERATURE = 0.2;

// ── Adapter helpers (both directions live here so the SDK never leaks) ──

/**
 * Strip JSON Schema fields the Cerebras / OpenAI tool spec may reject. Zod 4
 * emits draft 2020-12 (`$schema`, `additionalProperties`, `const`, numeric
 * `exclusiveMinimum`/`exclusiveMaximum`). Cerebras (Llama-class + gpt-oss)
 * tolerates more of draft 2020-12 than Gemini, but we keep the same
 * transformations defensively so the adapter surface is uniform across
 * providers — fewer schema-related debugging dead-ends. Identical
 * transformation table as `sanitizeForGemini`.
 *
 *  - `const: V` → `enum: [V]` (semantic equivalent in OpenAPI 3.0)
 *  - `exclusiveMinimum: N` → `minimum: N` (loses "strictly greater" hint but
 *    Zod stays the source of truth at runtime — defensa en profundidad)
 *  - `exclusiveMaximum: N` → `maximum: N` (idem)
 */
function sanitizeForOpenAI(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForOpenAI);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      if (k === "const") {
        out.enum = [v];
        continue;
      }
      if (k === "exclusiveMinimum" && typeof v === "number") {
        out.minimum = v;
        continue;
      }
      if (k === "exclusiveMaximum" && typeof v === "number") {
        out.maximum = v;
        continue;
      }
      out[k] = sanitizeForOpenAI(v);
    }
    return out;
  }
  return node;
}

/**
 * OpenAI Tool[] shape per Cerebras SDK
 * (`ChatCompletionCreateParams.Tool` — see
 * `node_modules/@cerebras/cerebras_cloud_sdk/resources/chat/completions.d.ts`
 * L790-814). `parameters` is typed `unknown | null` so any JSON Schema goes;
 * we ship the sanitized Zod-derived schema.
 */
type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
};

function toOpenAITools(tools: readonly Tool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: sanitizeForOpenAI(z.toJSONSchema(t.inputSchema)),
    },
  }));
}

/**
 * Provider tool-call shape (`Choice.Message.ToolCall`) → port-neutral
 * `ToolCall[]`. Unlike Gemini's `FunctionCall` (no id, name+args only),
 * Cerebras issues a stable `id: "call_*"` per tool invocation — we pass it
 * through directly. Arguments arrive as JSON-stringified per the OpenAI
 * convention; parse defensively (model may emit malformed JSON, in which
 * case we surface `{ raw: <string> }` so the executor can fail validation
 * gracefully via the matching tool's `inputSchema`).
 */
type ProviderToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

function fromOpenAICalls(
  calls: ProviderToolCall[] | null | undefined,
): ToolCall[] {
  if (!calls) return [];
  return calls.map((c) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(c.function.arguments);
    } catch {
      parsed = { _raw: c.function.arguments };
    }
    return {
      id: c.id,
      name: c.function.name,
      input: parsed,
    };
  });
}

/**
 * Translate a port-neutral `ConversationTurn[]` into the OpenAI-format
 * messages array Cerebras consumes. Quirks worth noting:
 *
 *  1. `tool_result` turns become `{ role: "tool", tool_call_id, content }`.
 *     The `tool_call_id` MUST match an `id` from a prior assistant turn's
 *     `tool_calls[]` — Cerebras rejects orphaned tool messages.
 *  2. A `ModelTurn` carrying ONLY tool calls (empty text) emits
 *     `content: null` per OpenAI convention. A `ModelTurn` carrying text
 *     emits `content: <text>` and may also carry `tool_calls[]` alongside
 *     (parallel tool calls + text response are valid).
 *  3. Arguments inside `tool_calls[]` MUST be JSON-stringified — the SDK
 *     does not auto-serialize.
 *  4. `tool_result.result` is JSON-stringified into the `content` field;
 *     OpenAI tool messages require string content (not object).
 *
 * The system prompt is INJECTED as the first message with `role: "system"`,
 * unlike Gemini's separate `systemInstruction` parameter.
 */
function mapTurnsToOpenAIMessages(
  systemPrompt: string,
  history: readonly ConversationTurn[],
): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const turn of history) {
    switch (turn.kind) {
      case "user":
        messages.push({ role: "user", content: turn.content });
        break;
      case "model": {
        const calls = turn.toolCalls ?? [];
        if (calls.length > 0) {
          messages.push({
            role: "assistant",
            content: turn.content ? turn.content : null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function",
              function: {
                name: c.name,
                arguments: JSON.stringify(c.input ?? {}),
              },
            })),
          });
        } else {
          messages.push({
            role: "assistant",
            content: turn.content,
          });
        }
        break;
      }
      case "tool_result":
        messages.push({
          role: "tool",
          tool_call_id: turn.toolCallId,
          content:
            typeof turn.result === "string"
              ? turn.result
              : JSON.stringify(turn.result),
        });
        break;
    }
  }
  return messages;
}

type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function fromOpenAIUsage(usage: OpenAIUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  // Only emit a usage record when totals are present — avoids reporting
  // misleading zeros if the provider drops a field. Mirrors Gemini adapter.
  if (usage.total_tokens == null) return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens,
  };
}

// ── Adapter ──

export class CerebrasLLMAdapter implements LLMProviderPort {
  async query({
    systemPrompt,
    userMessage,
    tools,
    conversationHistory,
  }: LLMQuery): Promise<LLMResponse> {
    // Dual-mode dispatch (locked design contract — see paired sister
    // gemini-llm.adapter.ts L209-217):
    //   - history present + non-empty → IGNORE userMessage and build messages
    //     from the history (caller MUST push the new user msg as the
    //     trailing UserTurn — invariant enforced in chat.ts loop).
    //   - history absent or empty → single-shot path: [system, user].
    const messages: OpenAIMessage[] =
      conversationHistory && conversationHistory.length > 0
        ? mapTurnsToOpenAIMessages(systemPrompt, conversationHistory)
        : [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ];

    const params: {
      model: string;
      messages: OpenAIMessage[];
      temperature: number;
      tools?: OpenAITool[];
      tool_choice?: "auto";
    } = {
      model: MODEL_ID,
      messages,
      temperature: TEMPERATURE,
    };

    if (tools.length > 0) {
      params.tools = toOpenAITools([...tools]);
      params.tool_choice = "auto";
    }

    let response;
    try {
      // SDK signature is overloaded; the non-streaming overload returns
      // ChatCompletion.ChatCompletionResponse (see resources/chat/completions
      // .d.ts L21). We do not pass `stream: true`, so we get the resolved
      // response object directly.
      // Cast through unknown for the SDK overload — the typed surface uses
      // a discriminated union we can narrow on the response shape.
      response = (await cerebras.chat.completions.create(
        params as unknown as Parameters<
          typeof cerebras.chat.completions.create
        >[0],
      )) as {
        choices: Array<{
          message: {
            content?: string | null;
            tool_calls?: ProviderToolCall[] | null;
          };
        }>;
        usage?: OpenAIUsage;
      };
    } catch (err) {
      // 429 quota exceeded → re-throw tipado para que el route handler
      // responda 429 user-friendly en lugar del 500 generic. Mirror of
      // Gemini adapter behavior. Otros errores (red, auth, content blocked)
      // bubble-uppean sin transformar — handleError los traduce a 500.
      if (isQuotaExceededError(err)) {
        logStructured({
          event: "cerebras_quota_exceeded",
          level: "warn",
          error: err instanceof Error ? err.message : String(err),
        });
        throw new LLMQuotaExceededError(undefined, err);
      }
      throw err;
    }

    const choice = response.choices?.[0];
    const message = choice?.message;
    // Defensive: response.choices may be undefined on degenerate SDK paths;
    // empty text + empty tool calls is a valid neutral result.
    return {
      text: message?.content ?? "",
      toolCalls: fromOpenAICalls(message?.tool_calls),
      usage: fromOpenAIUsage(response.usage),
    };
  }
}
