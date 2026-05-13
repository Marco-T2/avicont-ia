/**
 * Public index barrel for modules/ai-agent (POC ai-agent-hex C3).
 *
 * Surface MIRRORS pre-migration `features/ai-agent/index.ts` exactly so the
 * 2 public-barrel consumers (app/api/analyze/route.ts → analyzeDocument;
 * components/agent/registrar-con-ia/types.ts → AgentSuggestion) cut over at
 * C4 with a pure path rewrite, zero surface drift.
 *
 * Note: this is the public-barrel surface. Server-only and client-only
 * consumers MUST use the dedicated barrels (`./server` and `./client`).
 */
export { analyzeDocument } from "../infrastructure/llm/gemini-llm.adapter";
export type * from "../domain/types/agent.types";
