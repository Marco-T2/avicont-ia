import "server-only";
import { NotFoundError } from "@/features/shared/errors";
import {
  LocalLotInquiryAdapter,
  makeLotService,
  type LotInquiryPort,
} from "@/modules/lot/presentation/server";
import { ExpensesService } from "@/features/expenses/server";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
import type { LotPricingResult } from "./pricing.types";

type MortalityServiceImpl = ReturnType<typeof makeMortalityService>;

export class PricingService {
  private readonly lotInquiry: LotInquiryPort;
  private readonly expensesService: ExpensesService;
  private readonly mortalityService: MortalityServiceImpl;

  constructor(
    lotInquiry?: LotInquiryPort,
    expensesService?: ExpensesService,
    mortalityService?: MortalityServiceImpl,
  ) {
    this.lotInquiry =
      lotInquiry ?? new LocalLotInquiryAdapter(makeLotService());
    this.expensesService = expensesService ?? new ExpensesService();
    this.mortalityService = mortalityService ?? makeMortalityService();
  }

  // ── Calculate cost per chicken for a lot ──

  async calculateLotCost(
    organizationId: string,
    lotId: string,
  ): Promise<LotPricingResult> {
    const lot = await this.lotInquiry.findById(organizationId, lotId);
    if (!lot) throw new NotFoundError("Lote");

    const [totalExpenses, totalMortality] = await Promise.all([
      this.expensesService.getTotalByLot(organizationId, lotId),
      this.mortalityService.getTotalByLot(organizationId, lotId),
    ]);

    const aliveCount = lot.initialCount - totalMortality;
    const costPerChicken = aliveCount <= 0 ? null : totalExpenses / aliveCount;

    return {
      lotId: lot.id,
      lotName: lot.name,
      initialCount: lot.initialCount,
      totalExpenses,
      totalMortality,
      aliveCount,
      costPerChicken,
      totalLotCost: totalExpenses,
    };
  }
}
