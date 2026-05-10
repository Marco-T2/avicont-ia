export interface ComputeLotSummaryInput {
  initialCount: number;
  expenses: { amount: number }[];
  mortalityLogs: { count: number }[];
}

export class LotSummary {
  private constructor(
    private readonly _totalExpenses: number,
    private readonly _totalMortality: number,
    private readonly _aliveCount: number,
    private readonly _costPerChicken: number,
  ) {}

  static compute(input: ComputeLotSummaryInput): LotSummary {
    const totalExpenses = input.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalMortality = input.mortalityLogs.reduce((sum, m) => sum + m.count, 0);
    const aliveCount = Math.max(0, input.initialCount - totalMortality);
    const costPerChicken = aliveCount > 0 ? totalExpenses / aliveCount : 0;
    return new LotSummary(totalExpenses, totalMortality, aliveCount, costPerChicken);
  }

  get totalExpenses(): number { return this._totalExpenses; }
  get totalMortality(): number { return this._totalMortality; }
  get aliveCount(): number { return this._aliveCount; }
  get costPerChicken(): number { return this._costPerChicken; }
}
