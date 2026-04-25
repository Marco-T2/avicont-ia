// Barrel for the active LLM provider. To swap providers (e.g. Gemini → Claude)
// you should only need to change the `llmClient` re-export below to point at
// the new implementation file. Consumers import from `./llm`, never from
// `./llm/gemini` directly — see the grep test in the audit notes.

export type {
  LLMClient,
  LLMQuery,
  LLMResponse,
  TokenUsage,
  Tool,
  ToolCall,
} from "./types";
export { defineTool } from "./types";
export { geminiClient as llmClient, analyzeDocument } from "./gemini";
