import type { EquityStatementService } from "./equity-statement.service";

/**
 * Placeholder factory re-export for EquityStatementService.
 *
 * Real wiring (PrismaEquityStatementRepo + PrismaIncomeStatementSourceAdapter
 * injection) lives in `presentation/composition-root.ts` created at C3 GREEN.
 * This file satisfies the factory export reference without requiring C3 files.
 *
 * AXIS-DISTINCT vs TB: 2-adapter factory (repo + incomeSource) vs TB single-adapter.
 *
 * At C3 GREEN this placeholder is updated to re-export from composition-root:
 *   export { makeEquityStatementService } from "../presentation/composition-root";
 */
export function makeEquityStatementService(): EquityStatementService {
  throw new Error(
    "makeEquityStatementService: composition root not yet wired. " +
      "Real factory available after C3 GREEN (presentation/composition-root.ts).",
  );
}
