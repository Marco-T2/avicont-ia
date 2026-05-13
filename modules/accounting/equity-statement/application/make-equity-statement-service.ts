/**
 * Wrapper re-export for the composition-root factory.
 *
 * Delegates to presentation/composition-root.ts which wires both infrastructure
 * adapters into the application service:
 *   PrismaEquityStatementRepo   → EquityStatementQueryPort (6 methods)
 *   PrismaIncomeStatementSourceAdapter → IncomeStatementSourcePort (2 methods)
 *
 * This indirection keeps the application/ layer importable from tests without
 * pulling in presentation/ directly — consumers may import factory from either:
 *   - `application/make-equity-statement-service` (this wrapper)
 *   - `presentation/server` (canonical server-only barrel, REQ-002)
 *
 * AXIS-DISTINCT vs TB: 2-adapter factory (repo + incomeSource) vs TB single-adapter.
 * Sister precedent: modules/accounting/trial-balance/application/make-trial-balance-service.ts
 */
export { makeEquityStatementService } from "../presentation/composition-root";
