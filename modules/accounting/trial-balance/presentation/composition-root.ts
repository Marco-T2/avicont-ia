import { PrismaTrialBalanceRepo } from "../infrastructure/prisma-trial-balance.repo";
import { TrialBalanceExporterAdapter } from "../infrastructure/adapters/trial-balance-exporter.adapter";
import type { TrialBalanceService } from "../application/trial-balance.service";
import { makeTrialBalanceService as buildTrialBalanceService } from "../application/make-trial-balance-service";

/**
 * Zero-arg factory that wires infrastructure adapters into the application service.
 *
 * Per design §4: composition root = the ONLY place that instantiates infrastructure
 * concretions. The service receives `{ repo: TrialBalanceQueryPort }` deps-object,
 * not a concretion — port interface is the boundary.
 *
 * Called by server.ts (server-only context) and API routes via makeTrialBalanceService().
 * Never called from client components — those import TYPE-only from presentation/index.ts.
 *
 * Sister precedent: modules/accounting/financial-statements/presentation/composition-root.ts
 * (zero-arg factory pattern, GREEN b8b9dcf5).
 */
export function makeTrialBalanceService(): TrialBalanceService {
  const repo = new PrismaTrialBalanceRepo();
  // [EXPORT] cluster paydown — exporter port wired here (was a raw exporter
  // re-export from presentation/server.ts, R4 violation).
  const exporter = new TrialBalanceExporterAdapter();
  // [REVERSE-WIRING] paydown: the injectable factory lives in application/;
  // this zero-arg entry only instantiates concretions and passes them down.
  return buildTrialBalanceService({ repo, exporter });
}
