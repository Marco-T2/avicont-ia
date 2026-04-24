import "server-only";
import { ExternalSyncError } from "@/features/shared/errors";
import { clerkErrorFingerprint } from "./clerk-error-classifiers";
import {
  logCommitted,
  logCompensated,
  logDivergent,
  type SagaOperation,
} from "./member-clerk-saga.logger";

/**
 * Generic saga helper for members <-> Clerk write operations.
 *
 * Scoped to members (design §2 — explicit rejection of premature
 * generalization). When a second consumer (e.g. iva-books/ANAF) needs a
 * similar shape, extract a truly-generic helper THEN.
 *
 * Contract (pseudocode):
 *   1. { memberId, result } = await dbWrite()   // primary; throws bubble as-is
 *   2. try await clerkCall()
 *      catch (clerkErr):
 *        if isIdempotentSuccess(clerkErr): logCommitted; return result
 *        try await compensate(); logCompensated; throw ExternalSyncError  (single failure)
 *        catch (compErr): logDivergent; throw ExternalSyncError             (double failure)
 *   3. logCommitted; return result
 *
 * Invariants enforced by this single entry point (design §2):
 *   - DB-first ordering (REQ-MCS.1/2/3).
 *   - Idempotent-Clerk short-circuit (S-MCS.1-5/2-5/3-5).
 *   - `divergent` log fires ONLY on double failure (S-MCS.5-1, S-MCS.5-2).
 *   - The old asymmetric-swallow bug cannot recur.
 */

export type MemberSagaContext = {
  operation: SagaOperation;
  organizationId: string;
  memberId: string; // filled after primary write for add-new; known up-front otherwise
  clerkUserId: string;
  correlationId: string;
};

type MemberSagaInput<T> = {
  ctx: MemberSagaContext;
  dbWrite: () => Promise<{ memberId: string; result: T }>;
  clerkCall: () => Promise<void>;
  compensate: () => Promise<void>;
  /** Returns true if the Clerk error should be treated as an idempotent
   *  success (duplicate on create, 404 on delete). */
  isIdempotentSuccess: (err: unknown) => boolean;
  /** Caller-specific divergent payload — embedded on the thrown
   *  ExternalSyncError when compensation also fails. */
  divergentState: { dbState: string; clerkState: string };
};

function toCompensationErrorShape(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: "UnknownError", message: String(err) };
}

export async function runMemberClerkSaga<T>(input: MemberSagaInput<T>): Promise<T> {
  const { ctx, dbWrite, clerkCall, compensate, isIdempotentSuccess, divergentState } = input;

  // Step 1: primary DB write. Errors bubble as-is (500 via AppError handling).
  const { memberId, result } = await dbWrite();
  const resolvedCtx: MemberSagaContext = { ...ctx, memberId };

  // Step 2: Clerk call with compensation fallback.
  try {
    await clerkCall();
  } catch (clerkErr) {
    if (isIdempotentSuccess(clerkErr)) {
      logCommitted({
        operation: resolvedCtx.operation,
        organizationId: resolvedCtx.organizationId,
        memberId: resolvedCtx.memberId,
        clerkUserId: resolvedCtx.clerkUserId,
        correlationId: resolvedCtx.correlationId,
      });
      return result;
    }

    const clerkFingerprint = clerkErrorFingerprint(clerkErr);
    // Normalize fingerprint to the log's clerkError shape (drop the
    // non_clerk_error variant's `message` field — not needed in the
    // structured log entry).
    const clerkErrorForLog =
      "message" in clerkFingerprint && clerkFingerprint.code === "non_clerk_error"
        ? { code: clerkFingerprint.code }
        : (clerkFingerprint as { code?: string; status?: number; traceId?: string });

    try {
      await compensate();
    } catch (compErr) {
      logDivergent({
        operation: resolvedCtx.operation,
        organizationId: resolvedCtx.organizationId,
        memberId: resolvedCtx.memberId,
        clerkUserId: resolvedCtx.clerkUserId,
        correlationId: resolvedCtx.correlationId,
        dbState: divergentState.dbState,
        clerkState: divergentState.clerkState,
        clerkError: clerkErrorForLog,
        compensationError: toCompensationErrorShape(compErr),
      });
      throw new ExternalSyncError(
        "Clerk sync diverged — compensation also failed",
        {
          divergentState,
          operation: resolvedCtx.operation,
          correlationId: resolvedCtx.correlationId,
          clerkErrorCode: clerkErrorForLog.code,
          clerkTraceId: (clerkErrorForLog as { traceId?: string }).traceId,
        },
      );
    }

    // Single-failure: compensation succeeded, but Clerk failed.
    logCompensated({
      operation: resolvedCtx.operation,
      organizationId: resolvedCtx.organizationId,
      memberId: resolvedCtx.memberId,
      clerkUserId: resolvedCtx.clerkUserId,
      correlationId: resolvedCtx.correlationId,
      clerkError: clerkErrorForLog,
    });
    throw new ExternalSyncError(
      "Clerk sync failed — compensated",
      {
        divergentState,
        operation: resolvedCtx.operation,
        correlationId: resolvedCtx.correlationId,
        clerkErrorCode: clerkErrorForLog.code,
        clerkTraceId: (clerkErrorForLog as { traceId?: string }).traceId,
      },
    );
  }

  // Step 3: happy path.
  logCommitted({
    operation: resolvedCtx.operation,
    organizationId: resolvedCtx.organizationId,
    memberId: resolvedCtx.memberId,
    clerkUserId: resolvedCtx.clerkUserId,
    correlationId: resolvedCtx.correlationId,
  });
  return result;
}
