import type { InitialBalanceService } from "./initial-balance.service";
import { makeInitialBalanceService as _make } from "../presentation/composition-root";

/**
 * Application-layer factory wrapper for InitialBalanceService.
 *
 * Delegates to `presentation/composition-root.ts` — real wiring lives there
 * (PrismaInitialBalanceRepo → InitialBalanceService via deps-object IB-D4).
 *
 * Satisfies α31 (export) and α34 (InitialBalanceService reference) from the
 * C1 sentinel while keeping call sites in app/api/** decoupled from the
 * presentation layer import path.
 *
 * Per design §4 IB-D3: 1-adapter wiring (PrismaInitialBalanceRepo → InitialBalanceQueryPort).
 * Real factory: presentation/composition-root.ts (C3 GREEN).
 */
export function makeInitialBalanceService(): InitialBalanceService {
  return _make();
}
