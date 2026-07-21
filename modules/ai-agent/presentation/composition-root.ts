import "server-only";

import { CerebrasLLMAdapter } from "../infrastructure/llm/cerebras-llm.adapter";
import { PrismaChatMemoryRepository } from "../infrastructure/prisma/prisma-chat-memory.repo";
import { PrismaAgentContextRepository } from "../infrastructure/prisma/prisma-agent-context.repo";
import { PrismaRateLimitRepository } from "../infrastructure/prisma/prisma-agent-rate-limit.repo";
import { LegacyAccountsAdapter } from "../infrastructure/legacy-accounts.adapter";
import { LegacyRagAdapter } from "../infrastructure/legacy-rag.adapter";
import { PrismaTagsRepository } from "@/modules/tags/presentation/server";
import { makeRagService } from "@/modules/rag/presentation/server";
import {
  LocalLotInquiryAdapter,
  makeLotService,
} from "@/modules/lot/presentation/server";
import { AgentService } from "../application/agent.service";
import { AgentRateLimitService } from "../application/rate-limit.service";
import { PricingService } from "../application/pricing/pricing.service";
import type { AccountsLookupPort } from "../domain/ports/accounts-lookup.port";

/**
 * Composition root for modules/ai-agent (POC ai-agent-hex C3).
 * Single point of wiring concrete adapters to the agent services.
 * Mirror: modules/dispatch/presentation/composition-root.ts (dispatch C3
 * GREEN `5fd0cd42`) — same shape, one file that knows the concrete adapters.
 *
 * Extracted out of `presentation/server.ts` so the barrel stops importing
 * `infrastructure/` (R4, docs/architecture/03-rules-hard-rules.md:31).
 * ai-agent was the last of the 33 modules still wiring inside its barrel.
 *
 * `PrismaTagsRepository` comes from `@/modules/tags/presentation/server` (the
 * tags barrel), NOT from `modules/tags/infrastructure/`. Same pattern as
 * modules/dispatch consuming `PrismaOperationalDocTypesRepository` from the
 * operational-doc-type barrel — cross-module wiring goes through the public
 * presentation surface, never another module's infrastructure layer.
 */

/**
 * Composition root — zero-arg factory per design §3 / D1.
 * Mirror of paired sister `makeDispatchService()`.
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
  // REQ-43 — LegacyRagAdapter accepts an optional TagsRepositoryPort so
  // searchDocuments tag filters can resolve slugs to tag IDs server-side.
  // F4 — LegacyRagAdapter takes RagService as a REQUIRED param; this
  // composition root is where modules/rag gets wired into the agent.
  const rag = new LegacyRagAdapter(makeRagService(), new PrismaTagsRepository());
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

/**
 * Composition root — default AccountsLookupPort adapter.
 *
 * Exists so the `executeFindAccountsByPurpose` wrapper in `presentation/
 * server.ts` can resolve its default dependency WITHOUT naming an
 * infrastructure class in the barrel. The wrapper is not pure wiring (it has
 * a `deps` override branch, so the consumer/test can inject a fake), so it
 * stays in the barrel; only the "which concrete adapter is the default"
 * decision belongs here. Construction stays lazy — the wrapper calls this
 * only when no `accountsLookup` was injected, preserving the previous
 * `?? new LegacyAccountsAdapter()` runtime behavior exactly.
 */
export function makeAccountsLookup(): AccountsLookupPort {
  return new LegacyAccountsAdapter();
}

// ── analyzeDocument: Gemini-bound utility co-located in adapter (D8 arch debt) ──
// Bypasses LLMProviderPort by design — Gemini's analyzeDocument SDK call
// shape differs from LLMClient.query; 1 consumer (app/api/analyze/route.ts).
// Re-exported HERE (the one file allowed to import infrastructure) so the
// presentation barrels (index.ts / server.ts) surface it without naming an
// infrastructure module themselves (R4). Still honest residual debt: a proper
// port/use-case for document analysis remains pending (see archive notes).
export { analyzeDocument } from "../infrastructure/llm/gemini-llm.adapter";
