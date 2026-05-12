/**
 * T-CORR-A — withAuditTx unit tests
 *
 * Covers the behavioral contract of `withAuditTx` per design D2.b:
 *   1. Generates a fresh UUID v4 per call (two calls produce distinct UUIDs).
 *   2. setAuditContext is called BEFORE fn (call-order assertion).
 *   3. correlationId passed to setAuditContext as 5th arg equals the returned correlationId.
 *   4. Returns { result, correlationId } with the correct shape.
 *   5. Propagates justification to setAuditContext (4th arg).
 *   6. Forwards options.timeout / maxWait to repo.transaction.
 *   7. Propagates errors thrown by fn without swallowing.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import * as auditCtx from "@/modules/shared/infrastructure/audit-context";
import { withAuditTx } from "../audit-tx";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Minimal stand-in for the repo used in withAuditTx. */
interface MockRepo {
  transaction: ReturnType<typeof vi.fn> & {
    <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: { timeout?: number; maxWait?: number },
    ): Promise<T>;
  };
}

describe("withAuditTx", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;
  let mockRepo: MockRepo;

  beforeEach(() => {
    // Spy on setAuditContext and make it a no-op (avoids real DB).
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);

    // Mock repo.transaction: immediately executes the callback with a fake tx.
    const txFn = vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
        fn({} as Prisma.TransactionClient),
    );
    mockRepo = { transaction: txFn } as unknown as MockRepo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Case 1 ────────────────────────────────────────────────────────────────
  it("generates a fresh UUID v4 per call (two calls produce distinct UUIDs)", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const fn = vi.fn(async () => "ignored");

    const { correlationId: cid1 } = await withAuditTx(mockRepo, ctx, fn);
    const { correlationId: cid2 } = await withAuditTx(mockRepo, ctx, fn);

    expect(cid1).toMatch(UUID_V4_REGEX);
    expect(cid2).toMatch(UUID_V4_REGEX);
    expect(cid1).not.toBe(cid2);
  });

  // ─── Case 2 ────────────────────────────────────────────────────────────────
  it("calls setAuditContext BEFORE fn (call-order assertion)", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const fn = vi.fn(async () => "value");

    await withAuditTx(mockRepo, ctx, fn);

    const setAuditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const fnOrder = fn.mock.invocationCallOrder[0];

    expect(setAuditOrder).toBeLessThan(fnOrder);
  });

  // ─── Case 3 ────────────────────────────────────────────────────────────────
  it("passes the same correlationId to setAuditContext (5th arg) and to the return value", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const fn = vi.fn(async () => "payload");

    const { correlationId } = await withAuditTx(mockRepo, ctx, fn);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    const [, , , , passedCorrelationId] = setAuditContextSpy.mock.calls[0];
    expect(passedCorrelationId).toBe(correlationId);
    expect(correlationId).toMatch(UUID_V4_REGEX);
  });

  // ─── Case 4 ────────────────────────────────────────────────────────────────
  it('returns { result, correlationId } with the correct shape', async () => {
    const ctx = { userId: "u1", organizationId: "o1" };

    const { result, correlationId } = await withAuditTx(
      mockRepo,
      ctx,
      async () => "hello",
    );

    expect(result).toBe("hello");
    expect(correlationId).toMatch(UUID_V4_REGEX);
  });

  // ─── Case 5 ────────────────────────────────────────────────────────────────
  it("propagates justification to setAuditContext as 4th arg when provided", async () => {
    const ctx = { userId: "u1", organizationId: "o1", justification: "board-approved" };
    const fn = vi.fn(async () => null);

    await withAuditTx(mockRepo, ctx, fn);

    const [, , , justificationArg] = setAuditContextSpy.mock.calls[0];
    expect(justificationArg).toBe("board-approved");
  });

  it("passes undefined justification to setAuditContext when omitted", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const fn = vi.fn(async () => null);

    await withAuditTx(mockRepo, ctx, fn);

    const [, , , justificationArg] = setAuditContextSpy.mock.calls[0];
    expect(justificationArg).toBeUndefined();
  });

  // ─── Case 6 ────────────────────────────────────────────────────────────────
  it("forwards options.timeout and maxWait to repo.transaction as 2nd arg", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const fn = vi.fn(async () => 42);
    const options = { timeout: 15_000, maxWait: 5_000 };

    await withAuditTx(mockRepo, ctx, fn, options);

    expect(mockRepo.transaction).toHaveBeenCalledTimes(1);
    const [, passedOptions] = mockRepo.transaction.mock.calls[0];
    expect(passedOptions).toEqual(options);
  });

  // ─── Case 7 ────────────────────────────────────────────────────────────────
  it("propagates errors thrown by fn without swallowing", async () => {
    const ctx = { userId: "u1", organizationId: "o1" };
    const boom = new Error("db constraint violated");
    const fn = vi.fn(async () => {
      throw boom;
    });

    await expect(withAuditTx(mockRepo, ctx, fn)).rejects.toThrow(
      "db constraint violated",
    );
    await expect(withAuditTx(mockRepo, ctx, fn)).rejects.toBe(boom);
  });
});
