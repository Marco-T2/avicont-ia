import "server-only";

/**
 * Structured log emitters for the members-clerk-sync-saga (design §5).
 *
 * No external logger dep — the codebase emits structured-JSON payloads via
 * `console.*` (see `features/monthly-close/monthly-close.service.ts` for the
 * existing `correlationId` pattern). Events are filterable by their `event`
 * discriminator in serverless log aggregation.
 *
 * REQ-MCS.5 (observability on divergence):
 *   - `members.clerk_sync.committed` on a successful saga run.
 *   - `members.clerk_sync.compensated` on compensation-success (Clerk failed
 *     but the DB compensation restored consistency). Warning severity.
 *   - `members.clerk_sync.divergent` ONLY on double failure (Clerk failed AND
 *     compensation failed — operator-reconciliation signal).
 *
 * PII: `email` is deliberately NOT logged. `memberId` + `organizationId`
 * provide the correlation anchor.
 */

export type SagaOperation = "add" | "reactivate" | "remove";

type SagaLogBase = {
  operation: SagaOperation;
  organizationId: string;
  memberId: string;
  clerkUserId: string;
  correlationId: string;
};

export type CommittedLog = SagaLogBase & {
  event: "members.clerk_sync.committed";
};

export type CompensatedLog = SagaLogBase & {
  event: "members.clerk_sync.compensated";
  clerkError: { code?: string; status?: number; traceId?: string };
};

export type DivergentLog = SagaLogBase & {
  event: "members.clerk_sync.divergent";
  dbState: string;
  clerkState: string;
  clerkError: { code?: string; status?: number; traceId?: string };
  compensationError: { name: string; message: string };
};

export function logCommitted(payload: Omit<CommittedLog, "event">): void {
  const entry: CommittedLog = { event: "members.clerk_sync.committed", ...payload };
  console.info(JSON.stringify(entry));
}

export function logCompensated(payload: Omit<CompensatedLog, "event">): void {
  const entry: CompensatedLog = { event: "members.clerk_sync.compensated", ...payload };
  console.warn(JSON.stringify(entry));
}

export function logDivergent(payload: Omit<DivergentLog, "event">): void {
  const entry: DivergentLog = { event: "members.clerk_sync.divergent", ...payload };
  console.error(JSON.stringify(entry));
}
