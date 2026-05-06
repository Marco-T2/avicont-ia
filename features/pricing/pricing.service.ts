import "server-only";
import { LotsService } from "@/features/lots/server";
import { ExpensesService } from "@/features/expenses/server";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
import type { LotPricingResult } from "./pricing.types";

type MortalityServiceImpl = ReturnType<typeof makeMortalityService>;

export class PricingService {
  private readonly lotsService: LotsService;
  private readonly expensesService: ExpensesService;
  private readonly mortalityService: MortalityServiceImpl;

  constructor(
    lotsService?: LotsService,
    expensesService?: ExpensesService,
    mortalityService?: MortalityServiceImpl,
  ) {
    this.lotsService = lotsService ?? new LotsService();
    this.expensesService = expensesService ?? new ExpensesService();
    this.mortalityService = mortalityService ?? makeMortalityService();
  }

  // ── Calculate cost per chicken for a lot ──

  async calculateLotCost(
    organizationId: string,
    lotId: string,
  ): Promise<LotPricingResult> {
    const lot = await this.lotsService.getById(organizationId, lotId);

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
