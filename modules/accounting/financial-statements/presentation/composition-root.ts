import { PrismaFinancialStatementsRepo } from "../infrastructure/prisma-financial-statements.repo";
import { LegacyAccountSubtypeLabelAdapter } from "../infrastructure/legacy-account-subtype-label.adapter";
import { FinancialStatementsService } from "../application/financial-statements.service";

/**
 * Zero-arg factory that wires the infrastructure adapters into the application service.
 *
 * Per design §4: composition root = the ONLY place that instantiates infrastructure
 * concretions. The service itself receives interfaces (port types), not concretions.
 *
 * Called by server.ts (server-only context) and API routes. Never called from
 * client components — those import TYPE-only from presentation/index.ts.
 *
 * Sister precedent: dispatch-hex composition-root.ts (zero-arg factory pattern);
 * ai-agent makeAgentService (same deps-object ctor wiring pattern).
 */
export function makeFinancialStatementsService(): FinancialStatementsService {
  const repo = new PrismaFinancialStatementsRepo();
  const subtypeLabel = new LegacyAccountSubtypeLabelAdapter();
  return new FinancialStatementsService({ repo, subtypeLabel });
}
