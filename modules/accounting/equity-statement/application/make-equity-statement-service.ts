import { EquityStatementService } from "./equity-statement.service";
import type { EquityStatementQueryPort } from "../domain/ports/equity-statement-query.port";
import type { EquityStatementExporterPort } from "../domain/ports/equity-statement-exporter.port";
import type { IncomeStatementSourcePort } from "./income-statement-source.port";

/**
 * Application-layer injectable factory for EquityStatementService.
 *
 * [REVERSE-WIRING] paydown: this file used to re-export the zero-arg factory
 * from presentation/composition-root.ts — an R2 violation (application
 * reaching UP into presentation). The wiring is now inverted: THIS is the
 * real factory, port-typed and concretion-free; presentation/composition-root
 * instantiates the infrastructure adapters and calls this with the deps.
 *
 * AXIS-DISTINCT vs TB: 2-port injection (repo + incomeSource) vs TB single-port.
 * Sister precedent: modules/accounting/trial-balance/application/make-trial-balance-service.ts
 */
export function makeEquityStatementService(deps: {
  repo: EquityStatementQueryPort;
  incomeSource: IncomeStatementSourcePort;
  exporter: EquityStatementExporterPort;
}): EquityStatementService {
  return new EquityStatementService(deps);
}
