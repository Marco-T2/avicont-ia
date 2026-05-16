/**
 * FIN-1 RED→GREEN — sumDebitCredit (inside-TX balance check) must include
 * LOCKED-period JEs (REQ-2.5 — L51).
 *
 * Same fake-tx SQL-capture pattern as T-05 sister. Adapter is tx-bound so we
 * pass the fake as `Prisma.TransactionClient`.
 */
import type { Prisma } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaAccountingReaderAdapter } from "../prisma-accounting-reader.adapter";

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

describe("PrismaAccountingReaderAdapter — FIN-1 inside-TX balance includes LOCKED", () => {
  it("sumDebitCredit composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    let capturedSql = "";
    const fakeTx = {
      $queryRaw: vi.fn(
        async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
          capturedSql = renderSql(strings, values);
          return [];
        },
      ),
    };
    const adapter = new PrismaAccountingReaderAdapter(
      fakeTx as unknown as Prisma.TransactionClient,
    );
    await adapter.sumDebitCredit("org-1", "period-1");

    expect(capturedSql).toContain("IN ('POSTED','LOCKED')");
    expect(capturedSql).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
