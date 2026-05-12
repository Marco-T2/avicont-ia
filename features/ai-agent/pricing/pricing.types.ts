export interface LotPricingResult {
  lotId: string;
  lotName: string;
  initialCount: number;
  totalExpenses: number;
  totalMortality: number;
  aliveCount: number;
  costPerChicken: number | null;
  totalLotCost: number;
}
