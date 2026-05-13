import type { InitialBalanceService } from "./initial-balance.service";

/**
 * Factory placeholder for InitialBalanceService.
 *
 * Stub: throws at call time. Will be wired to
 * `presentation/composition-root.ts` at C3 GREEN, where PrismaInitialBalanceRepo
 * is injected into InitialBalanceService via deps-object ctor (IB-D4).
 *
 * Satisfies α31 (export) and α34 (InitialBalanceService reference) from the
 * C1 sentinel while keeping the application layer free of infrastructure concretions.
 *
 * Per design §4 IB-D3: 1-adapter wiring (PrismaInitialBalanceRepo → InitialBalanceQueryPort).
 * Real factory in presentation/composition-root.ts (C3).
 */
export function makeInitialBalanceService(): InitialBalanceService {
  throw new Error(
    "makeInitialBalanceService: not yet wired — composition-root.ts wires at C3 GREEN",
  );
}
