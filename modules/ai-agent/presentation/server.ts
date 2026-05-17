import "server-only";

/**
 * Presentation/server barrel for modules/ai-agent (POC ai-agent-hex C3).
 *
 * REQ-002: `import "server-only"` MUST be line 1 (positional). Next.js 16.2.1
 * (server-and-client-components.md L551-573) will emit a build error if any
 * client-marked module transitively imports this file. Codebase precedent:
 * features/ai-agent/server.ts L1 (pre-migration).
 *
 * Composition root: zero-arg factory `makeAgentService()` per design §3 (D1).
 * Paired sister: `modules/dispatch/presentation/composition-root.ts`
 * (dispatch C3 GREEN `5fd0cd42`) — same shape, single point of adapter wiring.
 *
 * AXIS-DISTINCT (honest surface): this is the FIRST hex module with a
 * dual-barrel presentation (server.ts + client.ts) — D5 lock per design §4.
 * dispatch shipped a single server barrel only.
 *
 * Re-exports match the pre-migration `features/ai-agent/server.ts` surface
 * so consumer cutover at C4 is a pure path rewrite (no surface drift).
 */

import { CerebrasLLMAdapter } from "../infrastructure/llm/cerebras-llm.adapter";
import { PrismaChatMemoryRepository } from "../infrastructure/prisma/prisma-chat-memory.repo";
import { PrismaAgentContextRepository } from "../infrastructure/prisma/prisma-agent-context.repo";
import { PrismaRateLimitRepository } from "../infrastructure/prisma/prisma-agent-rate-limit.repo";
import { LegacyAccountsAdapter } from "../infrastructure/legacy-accounts.adapter";
import { LegacyRagAdapter } from "../infrastructure/legacy-rag.adapter";
import {
  LocalFarmInquiryAdapter,
  makeFarmService,
} from "@/modules/farm/presentation/server";
import {
  LocalLotInquiryAdapter,
  makeLotService,
} from "@/modules/lot/presentation/server";
import { AgentService } from "../application/agent.service";
import { AgentRateLimitService } from "../application/rate-limit.service";
import { PricingService } from "../application/pricing/pricing.service";

/**
 * Composition root — zero-arg factory per design §3 / D1.
 * Mirror of paired sister `makeDispatchService()` (dispatch C3 GREEN `5fd0cd42`).
 *
 * Runtime invocation requires DB + CEREBRAS_API_KEY env — at import time
 * only the factory function shape is exposed (no top-level side effects
 * outside the CerebrasLLMAdapter module load, which validates
 * CEREBRAS_API_KEY at module init mirror of pre-cutover Gemini behavior).
 * GeminiLLMAdapter is preserved in tree (multi-provider fallback) but
 * unused at the composition root.
 *
 * Cleanup #2026-05-17 — `AccountingQueryAdapter` y los 5 services contables
 * (journals/ledger/sale/purchase/payments/accounts/contacts) que solo se
 * usaban acá fueron retirados. Las 8 tools de consulta contable del
 * sidebar-qa duplicaban las páginas dedicadas; Marco decidió que la UI
 * exacta es más confiable que la respuesta del LLM. Los services siguen
 * siendo invocados desde sus propios módulos / otros consumers.
 */
export function makeAgentService(): AgentService {
  const llmProvider = new CerebrasLLMAdapter();
  const chatMemory = new PrismaChatMemoryRepository();
  const contextReader = new PrismaAgentContextRepository();
  const rateLimitRepo = new PrismaRateLimitRepository();
  const accountsLookup = new LegacyAccountsAdapter();
  const rag = new LegacyRagAdapter();
  const farmInquiry = new LocalFarmInquiryAdapter(makeFarmService());
  const lotInquiry = new LocalLotInquiryAdapter(makeLotService());
  const pricingService = new PricingService();
  const rateLimit = new AgentRateLimitService(rateLimitRepo);

  return new AgentService({
    llmProvider,
    chatMemory,
    contextReader,
    rateLimit,
    accountsLookup,
    rag,
    farmInquiry,
    lotInquiry,
    pricingService,
  });
}

/**
 * Composition root — zero-arg factory for AgentRateLimitService.
 * Wires PrismaRateLimitRepository → AgentRateLimitService. Mirror of
 * makeAgentService shape — preserves zero-arg call site at consumers
 * after C4 cutover (old `new AgentRateLimitService()` was zero-arg).
 */
export function makeAgentRateLimitService(): AgentRateLimitService {
  const rateLimitRepo = new PrismaRateLimitRepository();
  return new AgentRateLimitService(rateLimitRepo);
}

// ── Service re-exports (orchestrators) ──────────────────────────────────────
export { AgentService } from "../application/agent.service";
export { AgentRateLimitService } from "../application/rate-limit.service";
export type { RateLimitDecision } from "../application/rate-limit.service";

// ── Validation schemas + AgentMode ──────────────────────────────────────────
export * from "../domain/validation/agent.validation";

// ── Domain types surface (consumer-facing) ──────────────────────────────────
export type * from "../domain/types/agent.types";
export type {
  JournalEntryAiContextHints,
  JournalEntryAiCatalogAccount,
  JournalEntryAiCatalogContact,
} from "../domain/prompts/journal-entry-ai.prompt";

// ── Tool executors (consumed by route handlers for assisted-capture flow) ──
import {
  executeFindAccountsByPurpose as _executeFindAccountsByPurpose,
  type FindAccountsByPurposeDeps,
} from "../application/tools/find-accounts";
import type {
  FindAccountsResult,
} from "../domain/tools/tool-output.types";

/**
 * Composition-root wrapper for executeFindAccountsByPurpose — preserves the
 * pre-migration two-arg call site at `app/api/.../accounts/route.ts`
 * (consumer calls `executeFindAccountsByPurpose(orgId, args)` with no deps).
 * Wires LegacyAccountsAdapter at the composition boundary so the consumer
 * stays barrel-clean per D1 zero-arg factory convention.
 */
export async function executeFindAccountsByPurpose(
  organizationId: string,
  input: { purpose: "expense" | "bank" | "cash"; query?: string },
  deps?: Partial<FindAccountsByPurposeDeps>,
): Promise<FindAccountsResult> {
  const accountsLookup = deps?.accountsLookup ?? new LegacyAccountsAdapter();
  return _executeFindAccountsByPurpose(organizationId, input, {
    accountsLookup,
    orgSettingsService: deps?.orgSettingsService,
  });
}

export {
  executeFindContact,
} from "../application/tools/find-contact";
export {
  executeParseAccountingOperation,
} from "../application/tools/parse-operation";
export type {
  FindAccountsResult,
  FindAccountsResultItem,
  FindContactResult,
  FindContactResultItem,
} from "../domain/tools/tool-output.types";

// ── analyzeDocument: Gemini-bound utility co-located in adapter (D8 arch debt) ──
// Bypasses LLMProviderPort by design — Gemini's analyzeDocument SDK call
// shape differs from LLMClient.query; 1 consumer (app/api/analyze/route.ts).
// Documented as honest residual in archive (paired sister: dispatch HubService).
export { analyzeDocument } from "../infrastructure/llm/gemini-llm.adapter";
