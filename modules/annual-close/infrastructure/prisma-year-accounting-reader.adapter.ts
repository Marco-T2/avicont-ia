import type { PrismaClient } from "@/generated/prisma/client";

import type {
  YearAccountingReaderPort,
  YearAggregateBalance,
} from "../domain/ports/year-accounting-reader.port";

/**
 * Phase 4.5 STUB — outside-TX year-aggregate reader scaffolding for tsc.
 */
export class PrismaYearAccountingReaderAdapter
  implements YearAccountingReaderPort
{
  constructor(private readonly db: Pick<PrismaClient, "$queryRaw">) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async aggregateYearDebitCreditNoTx(
    _orgId: string,
    _year: number,
  ): Promise<YearAggregateBalance> {
    throw new Error("STUB — Phase 4.6 GREEN pending");
  }
}
