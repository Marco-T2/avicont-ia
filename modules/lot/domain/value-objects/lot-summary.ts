export interface ComputeLotSummaryInput {
  initialCount: number;
  expenses: { amount: number }[];
  mortalityLogs: { count: number }[];
}

export class LotSummary {
  private constructor(
    public readonly totalExpenses: number,
    public readonly totalMortality: number,
    public readonly aliveCount: number,
    public readonly costPerChicken: number,
  ) {}

  static compute(input: ComputeLotSummaryInput): LotSummary {
    const totalExpenses = input.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalMortality = input.mortalityLogs.reduce((sum, m) => sum + m.count, 0);
    const aliveCount = Math.max(0, input.initialCount - totalMortality);
    const costPerChicken = aliveCount > 0 ? totalExpenses / aliveCount : 0;
    return new LotSummary(totalExpenses, totalMortality, aliveCount, costPerChicken);
  }

  toJSON() {
    return {
      totalExpenses: this.totalExpenses,
      totalMortality: this.totalMortality,
      aliveCount: this.aliveCount,
      costPerChicken: this.costPerChicken,
    };
  }
}
