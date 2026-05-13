import type { TrialBalanceService } from "./trial-balance.service";

/**
 * Placeholder factory re-export for TrialBalanceService.
 *
 * Real wiring (PrismaTrialBalanceRepo injection) lives in
 * `presentation/composition-root.ts` created at C3 GREEN.
 * This file satisfies the α33/α36 sentinel — exported name +
 * TrialBalanceService type reference — without requiring C3 files.
 *
 * At C3 GREEN this placeholder is updated to re-export from composition-root:
 *   export { makeTrialBalanceService } from "../presentation/composition-root";
 */
export function makeTrialBalanceService(): TrialBalanceService {
  throw new Error(
    "makeTrialBalanceService: composition root not yet wired. " +
      "Real factory available after C3 GREEN (presentation/composition-root.ts).",
  );
}
