/**
 * Domain-owned audit correlation types.
 *
 * `WithCorrelation<T>` decorates a result shape with the correlationId minted
 * by the audited transaction wrapper (`withAuditTx` in shared infrastructure).
 * The TYPE lives here so presentation/application layers can reference it
 * without importing infrastructure (hex R4/R2); `audit-tx.ts` keeps a
 * back-compat re-export.
 */
export type WithCorrelation<T> = T & { correlationId: string };
