import { Prisma } from "@/generated/prisma/client";

export {
  FINALIZED_JE_STATUSES,
  type FinalizedJeStatus,
} from "../domain/journal-status";

/**
 * Prisma SQL fragment for the finalized-JE filter (FIN-1).
 *
 * Renders as `IN ('POSTED','LOCKED')` and is intended to be interpolated
 * directly after `je.status` in a `$queryRaw` template, e.g.:
 *
 * ```ts
 * await db.$queryRaw`
 *   ... WHERE je.status ${FINALIZED_JE_STATUSES_SQL} ...
 * `;
 * ```
 *
 * Static literal (closed enum) — mirrors annual-close precedent at
 * `prisma-year-accounting-reader.adapter.ts:55`. Adding a future status to
 * the finalized set is an audited change, never a silent enum read.
 */
export const FINALIZED_JE_STATUSES_SQL: Prisma.Sql = Prisma.sql`IN ('POSTED','LOCKED')`;
