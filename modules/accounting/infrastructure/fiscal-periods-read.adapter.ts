import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type {
  AccountingFiscalPeriod,
  FiscalPeriodsReadPort,
} from "@/modules/accounting/domain/ports/fiscal-periods-read.port";

const legacy = makeFiscalPeriodsService();

/**
 * Cross-module narrow map (13→5 fields) sobre `makeFiscalPeriodsService().getById`
 * via `entity.toSnapshot()` bridge (FiscalPeriod entity → FiscalPeriodSnapshot
 * Prisma row shape). Throw legacy `NotFoundError(PERIOD_NOT_FOUND)` se propaga
 * sin re-wrap. startDate/endDate/name añadidos para invariante I12 (date∈período).
 */
export class FiscalPeriodsReadAdapter implements FiscalPeriodsReadPort {
  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<AccountingFiscalPeriod> {
    const entity = await legacy.getById(organizationId, periodId);
    const period = entity.toSnapshot();
    return {
      id: period.id,
      status: period.status,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }
}
