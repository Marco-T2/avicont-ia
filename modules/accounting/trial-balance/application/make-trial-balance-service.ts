import { TrialBalanceService } from "./trial-balance.service";
import type { TrialBalanceQueryPort } from "../domain/ports/trial-balance-query.port";
import type { TrialBalanceExporterPort } from "../domain/ports/trial-balance-exporter.port";

/**
 * Application-layer injectable factory for TrialBalanceService.
 *
 * [REVERSE-WIRING] paydown: this file used to delegate to the zero-arg
 * factory in presentation/composition-root.ts — an R2 violation (application
 * reaching UP into presentation). The wiring is now inverted: THIS is the
 * real factory, port-typed and concretion-free; presentation/composition-root
 * instantiates PrismaTrialBalanceRepo + TrialBalanceExporterAdapter and
 * calls this with the deps.
 *
 * This file satisfies the α33/α36 sentinel (function export + TrialBalanceService ref)
 * while keeping the application layer free of infrastructure concretions.
 */
export function makeTrialBalanceService(deps: {
  repo: TrialBalanceQueryPort;
  exporter: TrialBalanceExporterPort;
}): TrialBalanceService {
  return new TrialBalanceService(deps);
}
