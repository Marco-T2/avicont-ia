/**
 * ── CANONICAL RULE: FIN-1 (finalized JE statuses — read-path) ─────────────
 *
 * As of `posted-locked-aggregator-fix` (this change), the following invariants
 * are CANONICAL for accounting read-path aggregations:
 *
 * 1. `POSTED` and `LOCKED` are EQUIVALENT in read-path aggregations. Both
 *    represent "finalized journal entries" — contabilizados. Mutability
 *    differs (POSTED editable, LOCKED frozen) but is a WRITE-path concern only.
 *
 * 2. Aggregator `$queryRaw` blocks under `modules/** /infrastructure/` MUST
 *    use `FINALIZED_JE_STATUSES_SQL` (from `shared/infrastructure/journal-status.sql`)
 *    instead of bare `je.status = 'POSTED'` literal.
 *
 * 3. Prisma `where` consumers (count/findMany/aggregate) MUST use
 *    `{ status: { in: [...FINALIZED_JE_STATUSES] } }` instead of `status: "POSTED"`.
 *
 * 4. EXCEPTION — write-path `POSTED → LOCKED` cascades (e.g.
 *    `prisma-period-locking-writer.adapter.ts`) legitimately filter on
 *    `POSTED` alone; mark with `// sentinel-allow:posted-only-write-path`.
 *
 * Canonical text site: this file (`journal-status.ts` JSDoc).
 * Engram pointer: topic_key `sdd/posted-locked-aggregator-fix/proposal`.
 * Enforcement: `modules/accounting/__tests__/finalized-status-filter.sentinel.test.ts`.
 *
 * Per [[named_rule_immutability]]: FIN-1 is immutable. Expand via derivative
 * rule (`Derived from: FIN-1`), never mutate this block.
 */

/**
 * Readonly tuple of JE statuses considered "finalized" for read-path
 * aggregations (POSTED ∪ LOCKED). Mirrors annual-close precedent at
 * `prisma-year-accounting-reader.adapter.ts:55`.
 */
export const FINALIZED_JE_STATUSES = ["POSTED", "LOCKED"] as const;

/**
 * Union type derived from `FINALIZED_JE_STATUSES`.
 */
export type FinalizedJeStatus = (typeof FINALIZED_JE_STATUSES)[number];
