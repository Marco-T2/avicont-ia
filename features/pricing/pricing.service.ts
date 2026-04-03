import { NotFoundError } from "@/features/shared/errors";
import { LotsRepository } from "@/features/lots/lots.repository";
import { ExpensesRepository } from "@/features/expenses/expenses.repository";
import { MortalityRepository } from "@/features/mortality/mortality.repository";
import type { LotPricingResult } from "./pricing.types";

export class PricingService {
  private readonly lotsRepo: LotsRepository;
  private readonly expensesRepo: ExpensesRepository;
  private readonly mortalityRepo: MortalityRepository;

  constructor(
    lotsRepo?: LotsRepository,
    expensesRepo?: ExpensesRepository,
    mortalityRepo?: MortalityRepository,
  ) {
    this.lotsRepo = lotsRepo ?? new LotsRepository();
    this.expensesRepo = expensesRepo ?? new ExpensesRepository();
    this.mortalityRepo = mortalityRepo ?? new MortalityRepository();
  }

  // ── Calculate cost per chicken for a lot ──

  async calculateLotCost(
    organizationId: string,
    lotId: string,
  ): Promise<LotPricingResult> {
    const lot = await this.lotsRepo.findById(organizationId, lotId);
    if (!lot) throw new NotFoundError("Lote");

    const [totalExpenses, totalMortality] = await Promise.all([
      this.expensesRepo.sumByLot(organizationId, lotId),
      this.mortalityRepo.countByLot(organizationId, lotId),
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
