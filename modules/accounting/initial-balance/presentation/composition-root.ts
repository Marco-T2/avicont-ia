import { PrismaInitialBalanceRepo } from "../infrastructure/prisma-initial-balance.repo";
import { InitialBalanceService } from "../application/initial-balance.service";

/**
 * Zero-arg factory that wires infrastructure adapters into the application service.
 *
 * Per design §4: composition root = the ONLY place that instantiates infrastructure
 * concretions. The service receives `{ queryPort: InitialBalanceQueryPort }` deps-object,
 * not a concretion — port interface is the boundary (IB-D3).
 *
 * Called by server.ts (server-only context) and API routes via makeInitialBalanceService().
 * Never called from client components — those import TYPE-only from presentation/index.ts.
 *
 * 1-adapter wiring (WS/TB mirror, NOT ES 2-adapter shape):
 * PrismaInitialBalanceRepo → InitialBalanceService. No secondary port.
 *
 * Sister precedent: modules/accounting/worksheet/presentation/composition-root.ts
 * (zero-arg factory pattern — EXACT mirror).
 */
export function makeInitialBalanceService(): InitialBalanceService {
  const repo = new PrismaInitialBalanceRepo();
  return new InitialBalanceService({ queryPort: repo });
}
