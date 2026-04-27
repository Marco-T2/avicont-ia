import "server-only";
import { FiscalPeriodsService } from "../application/fiscal-periods.service";
import { PrismaFiscalPeriodRepository } from "../infrastructure/prisma-fiscal-period.repository";

export function makeFiscalPeriodsService(): FiscalPeriodsService {
  return new FiscalPeriodsService(new PrismaFiscalPeriodRepository());
}
