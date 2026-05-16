import type { PrismaClient } from "@/generated/prisma/client";

import { toNoonUtc } from "@/lib/date-utils";

import type { FiscalYearSnapshot } from "../domain/fiscal-year.entity";
import type {
  AnnualCloseDecemberPeriod,
  AnnualCloseResultAccount,
  FiscalYearPeriodCounts,
  FiscalYearReaderPort,
} from "../domain/ports/fiscal-year-reader.port";

/**
 * Postgres-backed outside-TX reader adapter for `FiscalYearReaderPort`
 * (design rev 2 §5, Phase 4.2 GREEN).
 *
 * Drives the pre-TX gate of `AnnualCloseService.close` + the read-only
 * `getSummary` use case. Mirrors `PrismaMonthlyCloseSummaryReaderAdapter`
 * precedent EXACT: `Pick<PrismaClient, tables>` ctor + Prisma typed-method
 * calls (no $queryRaw — these are simple lookups + a groupBy aggregate).
 *
 * §17 carve-out: the adapter consumes Prisma concretes for `fiscal_years`
 * (OWN), `fiscal_periods` (cross-module: BaseScope canonical, R3 vigente),
 * `journal_entries` (cross-module accounting), and `accounts` (cross-module
 * chart of accounts). Single use case (annual-close pre-TX gate) justifies
 * a local adapter mirror of monthly-close pattern.
 *
 * DEC-1 boundary: NO money math in this adapter — all reads return primitive
 * shapes (`{id, status}`, `{closed, open, total}`, `boolean`). Decimal-bearing
 * adapters live in `prisma-year-accounting-reader.adapter.ts`.
 *
 * **S-5** — `decemberPeriodOf` uses the `@@unique([organizationId, year, month])`
 * index defined at `prisma/schema.prisma:454`. This is the only place in the
 * annual-close adapter set that exercises that index; capture it in JSDoc to
 * prevent S-5 regression on schema reshuffles.
 */
export class PrismaFiscalYearReaderAdapter implements FiscalYearReaderPort {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "fiscalYear" | "fiscalPeriod" | "journalEntry" | "account"
    >,
  ) {}

  async getByYear(
    organizationId: string,
    year: number,
  ): Promise<FiscalYearSnapshot | null> {
    const row = await this.db.fiscalYear.findUnique({
      where: { organizationId_year: { organizationId, year } },
    });
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      year: row.year,
      status: row.status,
      closedAt: row.closedAt,
      closedBy: row.closedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async countPeriodsByStatus(
    organizationId: string,
    year: number,
  ): Promise<FiscalYearPeriodCounts> {
    const rows = await this.db.fiscalPeriod.groupBy({
      by: ["status"],
      where: { organizationId, year },
      _count: { _all: true },
    });
    let closed = 0;
    let open = 0;
    for (const r of rows) {
      if (r.status === "CLOSED") closed = r._count._all;
      else if (r.status === "OPEN") open = r._count._all;
    }
    return { closed, open, total: closed + open };
  }

  async ccExistsForYear(
    organizationId: string,
    year: number,
  ): Promise<boolean> {
    const row = await this.db.journalEntry.findFirst({
      where: {
        organizationId,
        status: "POSTED", // sentinel-allow:cc-freshness-read (CC always POSTED freshly inside same TX; pre-TX gate reads before lock — explorer §B.3)
        voucherType: { code: "CC" },
        date: {
          gte: toNoonUtc(`${year}-01-01`),
          lte: toNoonUtc(`${year}-12-31`),
        },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async decemberPeriodOf(
    organizationId: string,
    year: number,
  ): Promise<AnnualCloseDecemberPeriod | null> {
    // S-5 — exercises @@unique([organizationId, year, month]) at
    // prisma/schema.prisma:454.
    const row = await this.db.fiscalPeriod.findUnique({
      where: {
        organizationId_year_month: { organizationId, year, month: 12 },
      },
      select: { id: true, status: true },
    });
    if (!row) return null;
    return { id: row.id, status: row.status };
  }

  async findResultAccount(
    organizationId: string,
  ): Promise<AnnualCloseResultAccount | null> {
    const row = await this.db.account.findFirst({
      where: { organizationId, code: "3.2.2" },
      select: { id: true, code: true, nature: true },
    });
    if (!row) return null;
    return { id: row.id, code: row.code, nature: row.nature };
  }
}
