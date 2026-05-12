import type { Prisma } from "@/generated/prisma/client";
import { setAuditContext } from "./audit-context";

export type WithCorrelation<T> = T & { correlationId: string };

interface AuditTxContext {
  userId: string;
  organizationId: string;
  /** Required for LOCKED-document mutations; optional otherwise. */
  justification?: string;
}

interface RepoLike {
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T>;
}

/**
 * Runs `fn` inside a transaction with audit context (userId + correlationId)
 * already installed. The correlationId is generated BEFORE the tx so it is
 * preserved even on rollback. Returns `{ result, correlationId }`.
 *
 * Callers that need to expose correlationId in their public return shape
 * should spread it into their result object.
 */
export async function withAuditTx<R>(
  repo: RepoLike,
  ctx: AuditTxContext,
  fn: (tx: Prisma.TransactionClient, correlationId: string) => Promise<R>,
  options?: { timeout?: number; maxWait?: number },
): Promise<{ result: R; correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const result = await repo.transaction(async (tx) => {
    await setAuditContext(tx, ctx.userId, ctx.organizationId, ctx.justification, correlationId);
    return fn(tx, correlationId);
  }, options);
  return { result, correlationId };
}

/**
 * Runtime guard for INV-1: asserts that `app.current_user_id` is set on the
 * given transaction. Methods that accept an `externalTx` from a caller MUST
 * call this BEFORE any audited mutation — it is the canonical detection of
 * the anti-scenario described in REQ-CORR.4 (caller forgot to install audit
 * context on the outer tx before delegating).
 *
 * The error message identifies the caller-side fix path explicitly so that
 * the failure becomes self-explanatory in production logs.
 */
export async function assertAuditContextSet(
  tx: Prisma.TransactionClient,
  callerName: string,
): Promise<void> {
  const result = await tx.$queryRaw<Array<{ user_id: string | null }>>`
    SELECT current_setting('app.current_user_id', true) AS user_id
  `;
  const userId = result[0]?.user_id;
  if (!userId || userId === "") {
    throw new Error(
      `INV-1 violation: ${callerName} invoked with externalTx but setAuditContext ` +
        "was not called on the outer transaction. " +
        "Caller MUST call setAuditContext(externalTx, userId, organizationId, justification, correlationId) " +
        "before delegating to this method.",
    );
  }
}
