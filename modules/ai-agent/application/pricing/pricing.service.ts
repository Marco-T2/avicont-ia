import type {
  LotInquiryPort,
  LocalLotInquiryAdapter as _LocalLotInquiryAdapter,
  makeLotService as _makeLotService,
} from "@/modules/lot/presentation/server";
import type {
  ExpenseService,
  makeExpenseService as _makeExpenseService,
} from "@/modules/expense/presentation/server";
import type { makeMortalityService } from "@/modules/mortality/presentation/server";
import type { LotPricingResult } from "../../domain/pricing/pricing.types";

type MortalityServiceImpl = ReturnType<typeof makeMortalityService>;

/**
 * Pricing sub-aggregate co-located with the ai-agent module (D4).
 * Constructor takes no required args — heavy default services are lazy-loaded
 * the first time calculateLotCost runs (or supplied via setters for tests).
 *
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export class PricingService {
  private lotInquiry: LotInquiryPort | undefined;
  private expensesService: ExpenseService | undefined;
  private mortalityService: MortalityServiceImpl | undefined;

  constructor(
    lotInquiry?: LotInquiryPort,
    expensesService?: ExpenseService,
    mortalityService?: MortalityServiceImpl,
  ) {
    this.lotInquiry = lotInquiry;
    this.expensesService = expensesService;
    this.mortalityService = mortalityService;
  }

  private async ensureDeps(): Promise<{
    lotInquiry: LotInquiryPort;
    expensesService: ExpenseService;
    mortalityService: MortalityServiceImpl;
  }> {
    if (!this.lotInquiry) {
      const { LocalLotInquiryAdapter, makeLotService } = await import("@/modules/lot/presentation/server");
      this.lotInquiry = new LocalLotInquiryAdapter(makeLotService());
    }
    if (!this.expensesService) {
      const { makeExpenseService } = await import("@/modules/expense/presentation/server");
      this.expensesService = makeExpenseService();
    }
    if (!this.mortalityService) {
      const mod = await import("@/modules/mortality/presentation/server");
      this.mortalityService = mod.makeMortalityService();
    }
    return {
      lotInquiry: this.lotInquiry,
      expensesService: this.expensesService,
      mortalityService: this.mortalityService,
    };
  }

  // ── Calculate cost per chicken for a lot ──

  async calculateLotCost(
    organizationId: string,
    lotId: string,
  ): Promise<LotPricingResult> {
    const { lotInquiry, expensesService, mortalityService } = await this.ensureDeps();
    const { NotFoundError } = await import("@/features/shared/errors");

    const lot = await lotInquiry.findById(organizationId, lotId);
    if (!lot) throw new NotFoundError("Lote");

    const [totalExpenses, totalMortality] = await Promise.all([
      expensesService.getTotalByLot(organizationId, lotId),
      mortalityService.getTotalByLot(organizationId, lotId),
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
