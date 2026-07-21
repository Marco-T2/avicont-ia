import { InitialBalanceService } from "./initial-balance.service";
import type { InitialBalanceQueryPort } from "../domain/initial-balance.ports";
import type { InitialBalanceExporterPort } from "../domain/ports/initial-balance-exporter.port";

/**
 * Application-layer injectable factory for InitialBalanceService.
 *
 * [REVERSE-WIRING] paydown: this file used to delegate to the zero-arg
 * factory in presentation/composition-root.ts — an R2 violation (application
 * reaching UP into presentation). The wiring is now inverted: THIS is the
 * real factory, port-typed and concretion-free; presentation/composition-root
 * instantiates PrismaInitialBalanceRepo + InitialBalanceExporterAdapter and
 * calls this with the deps (IB-D4 deps-object, IB-D3 single query port).
 *
 * Satisfies α31 (export) and α34 (InitialBalanceService reference) from the
 * C1 sentinel.
 */
export function makeInitialBalanceService(deps: {
  queryPort: InitialBalanceQueryPort;
  exporter: InitialBalanceExporterPort;
}): InitialBalanceService {
  return new InitialBalanceService(deps);
}
