/**
 * Phase 6.1 RED — InitialBalanceQueryPort year-scoped extension.
 *
 * Per spec REQ-6.0 + REQ-6.1 (annual-close side-fix):
 *   - `getInitialBalanceFromCAForYear(orgId, year): InitialBalanceRow[]`
 *   - `countCAVouchersForYear(orgId, year): number`
 *   - `getCADateForYear(orgId, year): Date | null`
 *
 * Plus legacy semantics PRESERVED for 6.1 (will narrow in 6.3):
 *   - `getInitialBalanceFromCA(orgId)` still exists.
 *   - `countCAVouchers(orgId)` still exists.
 *   - `getCADate(orgId)` still exists.
 *
 * Declared failure mode (pre-GREEN):
 *   - PrismaInitialBalanceRepo does not implement the 3 new `*ForYear`
 *     methods yet → `typeof repo.getInitialBalanceFromCAForYear !==
 *     "function"` → assertion fails.
 *   - Port interface in `initial-balance.ports.ts` does not declare the
 *     new methods → TypeScript would normally catch this at compile time,
 *     but we use `as unknown as InitialBalanceQueryPort` to keep the test
 *     runnable while ports are STUB. tsc remains 0 errors because the
 *     test casts off the missing methods.
 *
 * GREEN flips at 6.2 once the adapter implements the 3 new methods AND the
 * port interface declares them.
 *
 * **Test layer**: pure shape/contract — no Prisma touch. Adapter methods
 * are stubbed in TS, asserted by method-presence + arity. Real
 * SQL/integration coverage is part of Phase 8 E2E.
 */
import { describe, it, expect } from "vitest";

import { PrismaInitialBalanceRepo } from "@/modules/accounting/initial-balance/infrastructure/prisma-initial-balance.repo";
import { prisma } from "@/lib/prisma";

describe("Phase 6.1 RED — InitialBalanceQueryPort year-scoped methods", () => {
  // Construct adapter using real prisma — only inspecting method presence,
  // not invoking SQL. (BaseRepository ctor takes a PrismaClient.)
  const repo = new PrismaInitialBalanceRepo(prisma);

  describe("NEW: year-scoped methods exist (REQ-6.0 + REQ-6.1)", () => {
    it("getInitialBalanceFromCAForYear is a function of arity 2 (orgId, year)", () => {
      expect(typeof (repo as unknown as Record<string, unknown>)
        .getInitialBalanceFromCAForYear).toBe("function");
      expect(
        (
          (repo as unknown as Record<string, (...args: unknown[]) => unknown>)
            .getInitialBalanceFromCAForYear
        )?.length,
      ).toBe(2);
    });

    it("countCAVouchersForYear is a function of arity 2", () => {
      expect(typeof (repo as unknown as Record<string, unknown>)
        .countCAVouchersForYear).toBe("function");
      expect(
        (
          (repo as unknown as Record<string, (...args: unknown[]) => unknown>)
            .countCAVouchersForYear
        )?.length,
      ).toBe(2);
    });

    it("getCADateForYear is a function of arity 2", () => {
      expect(typeof (repo as unknown as Record<string, unknown>)
        .getCADateForYear).toBe("function");
      expect(
        (
          (repo as unknown as Record<string, (...args: unknown[]) => unknown>)
            .getCADateForYear
        )?.length,
      ).toBe(2);
    });
  });

  describe("PRESERVED: legacy methods still exist (REQ-6.0 backward compat)", () => {
    it("getInitialBalanceFromCA still callable (legacy)", () => {
      expect(typeof repo.getInitialBalanceFromCA).toBe("function");
      expect(repo.getInitialBalanceFromCA.length).toBe(1);
    });

    it("countCAVouchers still callable (legacy)", () => {
      expect(typeof repo.countCAVouchers).toBe("function");
      expect(repo.countCAVouchers.length).toBe(1);
    });

    it("getCADate still callable (legacy)", () => {
      expect(typeof repo.getCADate).toBe("function");
      expect(repo.getCADate.length).toBe(1);
    });

    it("getOrgMetadata still callable", () => {
      expect(typeof repo.getOrgMetadata).toBe("function");
      expect(repo.getOrgMetadata.length).toBe(1);
    });
  });
});
