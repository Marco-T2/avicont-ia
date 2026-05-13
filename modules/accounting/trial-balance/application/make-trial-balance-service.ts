import type { TrialBalanceService } from "./trial-balance.service";
import { makeTrialBalanceService as _makeTrialBalanceService } from "../presentation/composition-root";

/**
 * Factory wrapper for TrialBalanceService.
 *
 * Delegates to `presentation/composition-root.ts` which wires
 * PrismaTrialBalanceRepo into TrialBalanceService via deps-object ctor.
 * This file satisfies the α33/α36 sentinel (function export + TrialBalanceService ref)
 * while keeping the application layer free of infrastructure concretions.
 *
 * Updated at C3 GREEN: placeholder throw replaced by composition-root delegation.
 */
export function makeTrialBalanceService(): TrialBalanceService {
  return _makeTrialBalanceService();
}
