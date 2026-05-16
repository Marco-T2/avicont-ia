/**
 * FIN-1 RED→GREEN — initial-balance repo 7 filter sites + JSDoc semantic
 * (REQ-2.8 — L97, L104, L139, L167, L215, L285, L309).
 *
 * Same fake-db SQL-capture pattern as T-05 sister. We assert each captured
 * $queryRaw template contains IN ('POSTED','LOCKED') and NO bare-literal
 * `je.status = 'POSTED'` / `je."status" = 'POSTED'` (any whitespace).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaInitialBalanceRepo } from "../infrastructure/prisma-initial-balance.repo";

function renderSql(strings: ReadonlyArray<string>, values: unknown[]): string {
  return strings
    .map((s, i) => {
      if (i === strings.length - 1) return s;
      const v = values[i];
      const inlined =
        v && typeof v === "object" && "sql" in v
          ? String((v as { sql: string }).sql)
          : `\${param${i}}`;
      return s + inlined;
    })
    .join("");
}

function makeCapturingDb() {
  const captures: string[] = [];
  const mockDb = {
    $queryRaw: vi.fn(
      async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
        captures.push(renderSql(strings, values));
        return [];
      },
    ),
  };
  return { mockDb, captures };
}

function expectAllFinalized(captures: string[]) {
  for (const sql of captures) {
    expect(sql).toContain("IN ('POSTED','LOCKED')");
    // Repo uses je."status" (quoted) in some sites; account for both forms.
    expect(sql).not.toMatch(/je\.?"?status"?\s*=\s*'POSTED'[^\n]*/);
  }
}

describe("PrismaInitialBalanceRepo — FIN-1 includes LOCKED CA voucher (7 sites)", () => {
  it("getInitialBalanceFromCA: both filter sites use FIN-1 (L97 outer + L104 subquery)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getInitialBalanceFromCA("org-1");
    expect(captures).toHaveLength(1);
    // Single SQL string contains BOTH filter sites — IN-clause should appear ≥ 2 times.
    const inMatches = captures[0].match(/IN \('POSTED','LOCKED'\)/g) ?? [];
    expect(inMatches.length).toBeGreaterThanOrEqual(2);
    expectAllFinalized(captures);
  });

  it("countCAVouchers uses FIN-1 (L139)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.countCAVouchers("org-1");
    expect(captures).toHaveLength(1);
    expectAllFinalized(captures);
  });

  it("countCAVouchersForYear uses FIN-1 (L167)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.countCAVouchersForYear("org-1", 2099);
    expect(captures).toHaveLength(1);
    expectAllFinalized(captures);
  });

  it("getInitialBalanceFromCAForYear uses FIN-1 (L215)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getInitialBalanceFromCAForYear("org-1", 2099);
    expect(captures).toHaveLength(1);
    expectAllFinalized(captures);
  });

  it("getCADate uses FIN-1 (L285)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getCADate("org-1");
    expect(captures).toHaveLength(1);
    expectAllFinalized(captures);
  });

  it("getCADateForYear uses FIN-1 (L309)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaInitialBalanceRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getCADateForYear("org-1", 2099);
    expect(captures).toHaveLength(1);
    expectAllFinalized(captures);
  });
});
