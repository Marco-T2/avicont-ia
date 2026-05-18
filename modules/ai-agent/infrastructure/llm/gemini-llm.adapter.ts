import "server-only";
import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from "@google/generative-ai";
import type Cerebras from "@cerebras/cerebras_cloud_sdk";
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
 * Detecta si un error del Google Gemini SDK es una respuesta 429 quota
 * exceeded. El SDK no expone error types tipados — el mensaje contiene
 * "429" o "quota" o "Too Many Requests" o el code "RESOURCE_EXHAUSTED".
 * Detección defensiva: cualquiera de los markers triggea el rethrow tipado.
 */
function isQuotaExceededError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("resource_exhausted")
  );
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "La API KEY de GEMINI no está configurada en las variables de entorno",
  );
}

const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_ID = "gemini-2.5-flash";

// ── Adapter (private, both directions live here so the SDK never leaks) ──

/**
 * Strip / rewrite JSON Schema fields the Gemini SDK does not accept. Zod 4
 * emits draft 2020-12 (`$schema`, `additionalProperties`, `const`, numeric
 * `exclusiveMinimum`/`exclusiveMaximum`) but Gemini's `Schema` whitelists an
 * OpenAPI 3.0 subset. Translations:
 *  - `const: V` → `enum: [V]` (semantic equivalent in OpenAPI)
 *  - `exclusiveMinimum: N` → `minimum: N` (loses "strictly greater" in the
 *    hint, but Zod stays the source of truth on the server — defensa en
 *    profundidad — so output strictly greater than N still gets enforced)
 *  - `exclusiveMaximum: N` → `maximum: N` (idem)
 */
function sanitizeForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
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
      out[k] = sanitizeForGemini(v);
    }
    return out;
  }
  return node;
}

function toGeminiTools(tools: readonly Tool[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: sanitizeForGemini(
      z.toJSONSchema(t.inputSchema),
    ) as FunctionDeclaration["parameters"],
  }));
}

function fromGeminiCalls(calls: FunctionCall[] | undefined): ToolCall[] {
  if (!calls) return [];
  return calls.map((c, i) => ({
    // Gemini does not issue a stable per-call id; synthesize one so the rest
    // of the system can reference the call (logs, future tool_result loop).
    id: `gem_${Date.now()}_${i}`,
    name: c.name,
    input: c.args,
  }));
}

/**
 * Translate a port-neutral `ConversationTurn[]` into the Gemini SDK's
 * `Content[]` shape (REQ-22). Three quirks worth keeping in mind:
 *
 *  1. `tool_result` turns MUST be wrapped in a `Content` with `role: "user"`
 *     (Gemini SDK contract — see
 *     `node_modules/@google/generative-ai/dist/generative-ai.d.ts`
 *     `FunctionResponsePart`).
 *  2. `FunctionResponse.response` is typed `object` — primitives, `null`, and
 *     non-object values are wrapped as `{ value: <raw> }` to satisfy the SDK
 *     without losing the underlying value. Error envelopes from the loop
 *     already arrive as `{ error: msg }` and pass through unchanged.
 *  3. A `ModelTurn` may carry text, tool calls, or both. We emit parts in the
 *     same order: text first (when non-empty), then one `functionCall` part
 *     per `ToolCall`.
 */
function wrapForFunctionResponse(result: unknown): object {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    return result;
  }
  return { value: result };
}

function mapTurnsToGeminiContents(
  history: readonly ConversationTurn[],
): Content[] {
  return history.map((turn): Content => {
    switch (turn.kind) {
      case "user":
        return { role: "user", parts: [{ text: turn.content }] };
      case "model": {
        const parts: Part[] = [];
        if (turn.content) parts.push({ text: turn.content });
        for (const call of turn.toolCalls ?? []) {
          parts.push({
            functionCall: {
              name: call.name,
              args: (call.input ?? {}) as object,
            },
          });
        }
        return { role: "model", parts };
      }
      case "tool_result":
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: turn.name,
                response: wrapForFunctionResponse(turn.result),
              },
            },
          ],
        };
    }
  });
}

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function fromGeminiUsage(meta: GeminiUsage | undefined): TokenUsage | undefined {
  if (!meta) return undefined;
  // The SDK marks all three counts optional; we only emit a usage record
  // when we have at least the totals to avoid reporting misleading zeros.
  if (meta.totalTokenCount == null) return undefined;
  return {
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    totalTokens: meta.totalTokenCount,
  };
}

// ── Adapter (renamed from GeminiClient per REQ-005) ──

/**
 * GeminiLLMAdapter — implements LLMProviderPort.
 * Renamed from GeminiClient (REQ-005). The module-level singleton
 * `llmClient = new GeminiClient()` from features/ai-agent/llm/gemini.ts is
 * ELIMINATED — instantiation is wired at the composition root (C3).
 */
export class GeminiLLMAdapter implements LLMProviderPort {
  async query({
    systemPrompt,
    userMessage,
    tools,
    conversationHistory,
  }: LLMQuery): Promise<LLMResponse> {
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: systemPrompt,
      tools:
        tools.length > 0
          ? [{ functionDeclarations: toGeminiTools([...tools]) }]
          : undefined,
    });

    // Dual-mode dispatch (REQ-22 + locked design contract):
    //   - history present + non-empty → IGNORE userMessage and build Content[]
    //     from the history (caller MUST push the new user msg as the trailing
    //     UserTurn — invariant enforced in chat.ts loop).
    //   - history absent or empty → preserve the pre-REQ-21 single-shot path:
    //     pass the bare userMessage string. Backward compat for existing
    //     callers (analyzeDocument, journal-entry-ai, etc.).
    let result;
    try {
      result =
        conversationHistory && conversationHistory.length > 0
          ? await model.generateContent({
              contents: mapTurnsToGeminiContents(conversationHistory),
            })
          : await model.generateContent(userMessage);
    } catch (err) {
      // Detección de 429 quota exceeded de Gemini → re-throw tipado para que
      // el route handler responda 429 con mensaje user-friendly en lugar del
      // 500 generic. Otros errores (red, auth, content blocked) bubble-uppean
      // sin transformar — handleError los traduce a 500.
      if (isQuotaExceededError(err)) {
        logStructured({
          event: "gemini_quota_exceeded",
          level: "warn",
          error: err instanceof Error ? err.message : String(err),
        });
        throw new LLMQuotaExceededError(undefined, err);
      }
      throw err;
    }
    const response = result.response;

    // response.text() throws ONLY when the candidate has bad finishReason
    // (SAFETY, RECITATION, LANGUAGE) or the prompt was blocked. For
    // function-only responses it returns "" without throwing. The catch is
    // not "hiding function calls" — it observes model blocks.
    let text = "";
    try {
      text = response.text();
    } catch (err) {
      logStructured({
        event: "gemini_response_parse_error",
        level: "warn",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      text,
      toolCalls: fromGeminiCalls(response.functionCalls()),
      usage: fromGeminiUsage(response.usageMetadata),
    };
  }
}

// ── Document analysis (Cerebras-backed; file name preserved for α71) ──

/**
 * Generates a document summary via Cerebras `gpt-oss-120b`.
 *
 * File name (`gemini-llm.adapter.ts`) is preserved per α71 sentinel
 * immutability ([[named_rule_immutability]]); the implementation swapped
 * to Cerebras to avoid Gemini free-tier daily quota (20/req) — the chat
 * agent already migrated in a prior session. The function still bypasses
 * LLMProviderPort by design (single-shot, no tools, no history) per the
 * D8 arch debt note. Re-exported via presentation/server.ts for the
 * app/api/analyze/route.ts consumer.
 */
export async function analyzeDocument(text: string): Promise<string> {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasKey) {
    throw new Error(
      "La API KEY de CEREBRAS no está configurada en las variables de entorno",
    );
  }
  // Lazy SDK load — see cerebras-llm.adapter.ts for the DEP0169 rationale.
  const { default: CerebrasCtor } = await import("@cerebras/cerebras_cloud_sdk");
  const client: Cerebras = new CerebrasCtor({ apiKey: cerebrasKey });
  try {
    const response = await client.chat.completions.create({
      model: "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "Sos un asistente que resume documentos. Generá un resumen integral en español, claro y conciso, con puntos clave y conclusiones. Sin markdown.",
        },
        { role: "user", content: text },
      ],
    });
    // OpenAI-compatible response shape — chat.completions returns choices[].
    const choices = (response as { choices?: Array<{ message?: { content?: string } }> }).choices;
    const content = choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Cerebras returned empty content for document analysis");
    }
    return content;
  } catch (err) {
    logStructured({
      event: "document_analysis_failed",
      level: "warn",
      provider: "cerebras",
      error: err instanceof Error ? err.message : String(err),
    });
    if (isQuotaExceededError(err)) {
      throw new LLMQuotaExceededError();
    }
    throw err;
  }
}
