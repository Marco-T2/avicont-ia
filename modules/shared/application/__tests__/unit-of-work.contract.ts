import { describe, expect, it } from "vitest";
import type {
  AuditContext,
  UnitOfWork,
} from "../../domain/ports/unit-of-work";

/**
 * Reusable contract suite for any UnitOfWork adapter.
 *
 * Every implementation (InMemoryUnitOfWork, PrismaUnitOfWork) MUST satisfy
 * these invariants. The integration test (T4) layers Postgres-specific
 * invariants ON TOP of this suite — it does NOT replace it.
 *
 * Invariants asserted here:
 *   1. fn is invoked exactly once per `run`.
 *   2. `scope.correlationId` is a non-empty string.
 *   3. The returned `correlationId` equals the one observed inside fn.
 *   4. Two consecutive `run`s produce different correlationIds.
 *   5. `scope.correlationId` is stable across awaits inside fn.
 *   6. `run` returns `{ result: <fn's return value>, correlationId }`.
 *   7. Errors thrown by fn propagate out of `run` unchanged.
 */

const auditCtx: AuditContext = {
  userId: "user-1",
  organizationId: "org-1",
};

export function describeUnitOfWorkContract(
  name: string,
  makeUow: () => UnitOfWork,
): void {
  describe(`UnitOfWork contract — ${name}`, () => {
    it("invokes fn exactly once per run", async () => {
      const uow = makeUow();
      let calls = 0;
      await uow.run(auditCtx, async () => {
        calls++;
        return null;
      });
      expect(calls).toBe(1);
    });

    it("provides a non-empty correlationId on the scope", async () => {
      const uow = makeUow();
      let observed: string | undefined;
      await uow.run(auditCtx, async (scope) => {
        observed = scope.correlationId;
        return null;
      });
      expect(observed).toBeDefined();
      expect(observed!.length).toBeGreaterThan(0);
    });

    it("returns the same correlationId that was on the scope", async () => {
      const uow = makeUow();
      let observed: string | undefined;
      const { correlationId } = await uow.run(auditCtx, async (scope) => {
        observed = scope.correlationId;
        return null;
      });
      expect(correlationId).toBe(observed);
    });

    it("returns a different correlationId for each run", async () => {
      const uow = makeUow();
      const { correlationId: id1 } = await uow.run(auditCtx, async () => null);
      const { correlationId: id2 } = await uow.run(auditCtx, async () => null);
      expect(id1).not.toBe(id2);
    });

    it("scope.correlationId is stable across awaits inside fn", async () => {
      const uow = makeUow();
      let first: string | undefined;
      let second: string | undefined;
      await uow.run(auditCtx, async (scope) => {
        first = scope.correlationId;
        await Promise.resolve();
        second = scope.correlationId;
        return null;
      });
      expect(first).toBe(second);
    });

    it("returns { result } where result is fn's return value", async () => {
      const uow = makeUow();
      const { result } = await uow.run(auditCtx, async () => "hello");
      expect(result).toBe("hello");
    });

    it("propagates errors thrown by fn", async () => {
      const uow = makeUow();
      const err = new Error("boom");
      await expect(
        uow.run(auditCtx, async () => {
          throw err;
        }),
      ).rejects.toBe(err);
    });

    it("exposes a fiscalPeriods repo on the scope", async () => {
      const uow = makeUow();
      let observed: unknown;
      await uow.run(auditCtx, async (scope) => {
        observed = scope.fiscalPeriods;
        return null;
      });
      expect(observed).toBeDefined();
      expect(typeof (observed as { markClosed: unknown }).markClosed).toBe(
        "function",
      );
    });
  });
}
