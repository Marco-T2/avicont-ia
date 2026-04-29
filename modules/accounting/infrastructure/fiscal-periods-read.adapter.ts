import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type {
  AccountingFiscalPeriod,
  FiscalPeriodsReadPort,
} from "@/modules/accounting/domain/ports/fiscal-periods-read.port";

const legacy = new FiscalPeriodsService();

/**
 * Cross-module narrow map (13→2 fields) sobre `FiscalPeriodsService.getById`.
 * Throw legacy `NotFoundError(PERIOD_NOT_FOUND)` se propaga sin re-wrap.
 */
export class FiscalPeriodsReadAdapter implements FiscalPeriodsReadPort {
  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<AccountingFiscalPeriod> {
    const period = await legacy.getById(organizationId, periodId);
    return { id: period.id, status: period.status };
  }
}
