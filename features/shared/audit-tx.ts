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
