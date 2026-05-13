import type { z } from "zod";

/**
 * Provider-neutral tool descriptor. The schema is a Zod type; the wrapper
 * converts it to JSON Schema for the LLM and the executor uses it for
 * runtime validation of the args produced by the model.
 */
export type Tool<TSchema extends z.ZodType = z.ZodType> = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TSchema;
};

/**
 * Identity helper that captures the schema generic so callers don't have to
 * annotate it. Use `defineTool({ ... })` instead of typing `Tool<...>` by hand.
 */
export function defineTool<TSchema extends z.ZodType>(
  tool: Tool<TSchema>,
): Tool<TSchema> {
  return tool;
}

/**
 * Provider-neutral tool call. `id` is synthesized by the wrapper when the
 * provider does not issue one (e.g. Gemini); Anthropic-style providers will
 * pass through their native id. `input` is `unknown` at this layer — the
 * executor narrows it via the matching tool's `inputSchema`.
 */
export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
};

export type TokenUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
};

export type LLMResponse = {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  /**
   * Token usage from the provider. Optional because some providers may not
   * report it (or may fail to populate it on certain error paths). The
   * executor should treat absence as "unknown", not zero.
   */
  readonly usage?: TokenUsage;
};

/**
 * Single argument object so future extensions (conversation history,
 * temperature/top_p, max_tokens, streaming callbacks, abort signal) can be
 * added as optional fields without breaking existing call sites or fighting
 * positional argument order.
 */
export type LLMQuery = {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly tools: readonly Tool[];
};

/**
 * Provider-neutral LLM port. Domain and application layers depend on this
 * interface only — no SDK imports, no Gemini specifics.
 * REQ-005: LLMProviderPort separated from GeminiLLMAdapter (adapter lands at C2).
 */
export interface LLMProviderPort {
  query(args: LLMQuery): Promise<LLMResponse>;
}
