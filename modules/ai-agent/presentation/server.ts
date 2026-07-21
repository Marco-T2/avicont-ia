import "server-only";

/**
 * Presentation/server barrel for modules/ai-agent (POC ai-agent-hex C3).
 *
 * REQ-002: `import "server-only"` MUST be line 1 (positional). Next.js 16.2.1
 * (server-and-client-components.md L551-573) will emit a build error if any
 * client-marked module transitively imports this file. Codebase precedent:
 * features/ai-agent/server.ts L1 (pre-migration).
 *
 * Wiring lives in `./composition-root` (the ONE file allowed to import
 * `infrastructure/` per R4, docs/architecture/03-rules-hard-rules.md:31).
 * This barrel only re-exports — same convention as the other 32 modules.
 * Paired sister: `modules/dispatch/presentation/server.ts`.
 *
 * AXIS-DISTINCT (honest surface): this is the FIRST hex module with a
 * dual-barrel presentation (server.ts + client.ts) — D5 lock per design §4.
 * dispatch shipped a single server barrel only.
 *
 * Re-exports match the pre-migration `features/ai-agent/server.ts` surface
 * so consumer cutover at C4 is a pure path rewrite (no surface drift).
 */

// ── Composition-root factories ──────────────────────────────────────────────
export { makeAgentService, makeAgentRateLimitService } from "./composition-root";

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
import { makeAccountsLookup } from "./composition-root";

/**
 * Wrapper for executeFindAccountsByPurpose — preserves the pre-migration
 * two-arg call site at `app/api/.../accounts/route.ts` (consumer calls
 * `executeFindAccountsByPurpose(orgId, args)` with no deps).
 *
 * This is NOT pure wiring: the optional `deps` override lets consumers/tests
 * inject fakes, so it stays in the barrel. The "which concrete adapter is
 * the default" decision is delegated to `makeAccountsLookup()` in the
 * composition root, keeping infrastructure out of this file (R4).
 * Construction stays lazy — identical runtime behavior to the previous
 * `deps?.accountsLookup ?? new LegacyAccountsAdapter()`.
 */
export async function executeFindAccountsByPurpose(
  organizationId: string,
  input: { purpose: "expense" | "bank" | "cash"; query?: string },
  deps?: Partial<FindAccountsByPurposeDeps>,
): Promise<FindAccountsResult> {
  const accountsLookup = deps?.accountsLookup ?? makeAccountsLookup();
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
// Routed through ./composition-root (hex-debt paydown): the barrel no longer
// names an infrastructure module (R4 cleared), but the underlying debt — no
// proper port/use-case for document analysis — remains open in composition-root.
export { analyzeDocument } from "./composition-root";
