import type { Prisma } from "@/generated/prisma/client";

import { lastDayOfUTCMonth } from "@/lib/date-utils";
import { monthNameEs } from "@/modules/fiscal-periods/domain/month-names";

import { YearOpeningPeriodsExistError } from "../domain/errors/annual-close-errors";
import type {
  CreateTwelvePeriodsInput,
  CreateTwelvePeriodsResult,
  PeriodAutoCreatorTxPort,
} from "../domain/ports/period-auto-creator-tx.port";

/**
 * Postgres-backed INSIDE-TX bulk creator for year+1's 12 FiscalPeriods
 * (`PeriodAutoCreatorTxPort` — design rev 2 §4 + §5, Phase 4.12 GREEN).
 *
 * Tx-bound at construction. Mirror precedent EXACT — consumer (UoW.run
 * callback) never sees the `tx` token.
 *
 * **Defensive TOCTOU gate** (spec REQ-5.2): counts existing FiscalPeriod
 * rows for `(orgId, year)` FIRST. Any count > 0 → throw
 * `YearOpeningPeriodsExistError`. Catches the case where year+1 was
 * partially initialised between the pre-TX gate and the TX entry.
 *
 * **W-4 contingency — per-row create over createMany**:
 *
 * The design rev 2 §5 acceptance test (Phase 8.1) requires `audit_logs ≥ 17`
 * rows per `correlationId` for the standard path; 12 of those rows come from
 * year+1 period creates. The `audit_fiscal_periods` trigger is per-row
 * (`AFTER INSERT FOR EACH ROW`), and Prisma `createMany` issues a single
 * multi-VALUES SQL statement. Postgres fires per-row triggers correctly on
 * multi-VALUES inserts, but only when `RETURNING` is consumed for every row
 * (driver-dependent). The defensive path is per-row `create` — guarantees
 * per-row trigger fire + audit completeness without driver assumptions.
 *
 * Trade-off: 12 sequential INSERTs instead of 1 batch. Acceptable — annual-
 * close runs ~once per year per org; the cost difference is microseconds
 * inside an already-bounded 60s TX (S-4). Decision driver: audit-trail
 * correctness > 1-time-per-year micro-perf.
 *
 * **Naming convention** (REQ-5.1): `Enero <year>`, ..., `Diciembre <year>`.
 * Spanish month names via `modules/fiscal-periods/domain/month-names`.
 * UTC month boundaries (`startDate = first day at 00:00 UTC`, `endDate =
 * last day at 00:00 UTC`) — mirror existing FiscalPeriod fixtures.
 */
export class PrismaPeriodAutoCreatorTxAdapter
  implements PeriodAutoCreatorTxPort
{
  constructor(private readonly tx: Pick<Prisma.TransactionClient, "fiscalPeriod">) {}

  async createTwelvePeriodsForYear(
    input: CreateTwelvePeriodsInput,
  ): Promise<CreateTwelvePeriodsResult> {
    // Defensive TOCTOU gate (REQ-5.2).
    const existingCount = await this.tx.fiscalPeriod.count({
      where: { organizationId: input.organizationId, year: input.year },
    });
    if (existingCount > 0) {
      throw new YearOpeningPeriodsExistError({
        year: input.year,
        existingCount,
      });
    }

    // W-4 — per-row create for audit trigger completeness.
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(Date.UTC(input.year, month - 1, 1));
      const endDate = lastDayOfUTCMonth(startDate);
      await this.tx.fiscalPeriod.create({
        data: {
          organizationId: input.organizationId,
          name: `${monthNameEs(month)} ${input.year}`,
          year: input.year,
          month,
          startDate,
          endDate,
          status: "OPEN",
          createdById: input.createdById,
        },
      });
    }

    // Re-read in month order to surface ids deterministically.
    const all = await this.tx.fiscalPeriod.findMany({
      where: { organizationId: input.organizationId, year: input.year },
      orderBy: { month: "asc" },
      select: { id: true, month: true },
    });

    const periodIds = all.map((r) => r.id);
    const jan = all.find((r) => r.month === 1);
    if (!jan) {
      // Defensive — would only happen if a concurrent TX wiped row month=1
      // between our INSERT and re-read. Inside the TX this is impossible.
      throw new Error(
        "PrismaPeriodAutoCreatorTxAdapter: January period not found after create-loop",
      );
    }
    return { periodIds, janPeriodId: jan.id };
  }
}
