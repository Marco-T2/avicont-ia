/**
 * FIN-1 RED→GREEN — 3 equity aggregator sites must include LOCKED-period
 * rows (REQ-2.3 — L65, L113, L167).
 *
 * Same fake-db SQL-capture pattern as T-05 sister.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaEquityStatementRepo } from "../infrastructure/prisma-equity-statement.repo";

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

describe("PrismaEquityStatementRepo — FIN-1 aggregators include LOCKED rows", () => {
  it("getPatrimonioBalancesAt composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaEquityStatementRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getPatrimonioBalancesAt("org-1", new Date("2099-12-31"));

    expect(captures).toHaveLength(1);
    expect(captures[0]).toContain("IN ('POSTED','LOCKED')");
    expect(captures[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });

  it("getTypedPatrimonyMovements composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaEquityStatementRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getTypedPatrimonyMovements(
      "org-1",
      new Date("2099-01-01"),
      new Date("2099-12-31"),
    );

    expect(captures).toHaveLength(1);
    expect(captures[0]).toContain("IN ('POSTED','LOCKED')");
    expect(captures[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });

  it("getAperturaPatrimonyDelta composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaEquityStatementRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.getAperturaPatrimonyDelta(
      "org-1",
      new Date("2099-01-01"),
      new Date("2099-12-31"),
    );

    expect(captures).toHaveLength(1);
    expect(captures[0]).toContain("IN ('POSTED','LOCKED')");
    expect(captures[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
