import type { ToolCall } from "../ports/llm-provider.port";

/**
 * Port-neutral conversation history primitive for the multi-turn chat loop
 * (REQ-19, REQ-20). A `ConversationTurn` is a discriminated union with three
 * variants:
 *
 *  - `user`         — a user message (prompt or follow-up).
 *  - `model`        — the assistant's textual response, optionally with the
 *                     `toolCalls` the model emitted on that turn.
 *  - `tool_result`  — the result of executing a tool from a prior model turn.
 *                     `toolCallId` pairs back to the `ToolCall.id` so adapters
 *                     can reconstitute provider-specific message shapes.
 *
 * No vendor SDK types (`@google/generative-ai` `Content`, `Part`, etc.) appear
 * here — that is enforced by `__tests__/conversation-turn.type.test.ts`
 * (SCN-20.2 hex-purity grep). Adapters translate this union into provider
 * shapes (e.g. the Gemini SDK `Content` array with `FunctionResponsePart`)
 * at the infrastructure boundary; see
 * `infrastructure/llm/gemini-llm.adapter.ts`.
 */
export type UserTurn = {
  readonly kind: "user";
  readonly content: string;
};

export type ModelTurn = {
  readonly kind: "model";
  readonly content: string;
  readonly toolCalls?: readonly ToolCall[];
};

export type ToolResultTurn = {
  readonly kind: "tool_result";
  readonly toolCallId: string;
  readonly name: string;
  /**
   * Raw tool output. May be a domain DTO, a primitive, or an error envelope
   * (`{ error: string }`). Adapters wrap primitives into objects when the
   * vendor SDK requires it (e.g. Gemini `FunctionResponse.response: object`).
   */
  readonly result: unknown;
};

export type ConversationTurn = UserTurn | ModelTurn | ToolResultTurn;
