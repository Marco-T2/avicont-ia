import type { Prisma } from "@/generated/prisma/client";

import type { AccountNature } from "../application/cc-line.builder";
import type { YearAggregateBalance } from "../domain/ports/year-accounting-reader.port";
import type {
  AnnualCloseFiscalYearStatus,
  AnnualClosePeriodStatus,
  YearAccountingReaderTxPort,
  YearAggregatedLine,
} from "../domain/ports/year-accounting-reader-tx.port";

/**
 * Phase 4.7 STUB — INSIDE-TX year reader scaffolding to keep tsc clean.
 */
export class PrismaYearAccountingReaderTxAdapter
  implements YearAccountingReaderTxPort
{
  constructor(
    private readonly tx: Pick<
      Prisma.TransactionClient,
      "$queryRaw" | "fiscalYear" | "fiscalPeriod" | "journalEntry" | "account"
    >,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async aggregateYearDebitCredit(_orgId: string, _year: number): Promise<YearAggregateBalance> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async aggregateResultAccountsByYear(_orgId: string, _year: number): Promise<YearAggregatedLine[]> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async aggregateBalanceSheetAccountsForCA(_orgId: string, _year: number): Promise<YearAggregatedLine[]> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findResultAccount(_orgId: string): Promise<{ id: string; code: string; nature: AccountNature } | null> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async reReadFiscalYearStatusTx(_fyId: string): Promise<AnnualCloseFiscalYearStatus | null> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async reReadPeriodStatusTx(_periodId: string): Promise<AnnualClosePeriodStatus | null> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async reReadCcExistsForYearTx(_orgId: string, _year: number): Promise<boolean> {
    throw new Error("STUB — Phase 4.8 GREEN pending");
  }
}
