import type { PrismaClient } from "@/generated/prisma/client";
import type {
  AnnualCloseDecemberPeriod,
  AnnualCloseResultAccount,
  FiscalYearPeriodCounts,
  FiscalYearReaderPort,
} from "../domain/ports/fiscal-year-reader.port";
import type { FiscalYearSnapshot } from "../domain/fiscal-year.entity";

/**
 * Phase 4.1 STUB — adapter scaffolding to keep tsc green during RED. Each
 * method throws so unit tests FAIL at runtime (RED contract); Phase 4.2
 * GREEN replaces every body with the real Prisma query.
 */
export class PrismaFiscalYearReaderAdapter implements FiscalYearReaderPort {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "fiscalYear" | "fiscalPeriod" | "journalEntry" | "account"
    >,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getByYear(_orgId: string, _year: number): Promise<FiscalYearSnapshot | null> {
    throw new Error("STUB — Phase 4.2 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async countPeriodsByStatus(_orgId: string, _year: number): Promise<FiscalYearPeriodCounts> {
    throw new Error("STUB — Phase 4.2 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ccExistsForYear(_orgId: string, _year: number): Promise<boolean> {
    throw new Error("STUB — Phase 4.2 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async decemberPeriodOf(_orgId: string, _year: number): Promise<AnnualCloseDecemberPeriod | null> {
    throw new Error("STUB — Phase 4.2 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findResultAccount(_orgId: string): Promise<AnnualCloseResultAccount | null> {
    throw new Error("STUB — Phase 4.2 GREEN pending");
  }
}
