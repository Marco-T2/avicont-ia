import type { PaymentForCreditCalc } from "../ports/types";

export class CreditBalance {
  private constructor(public readonly amount: number) {}

  static fromPayments(payments: PaymentForCreditCalc[]): CreditBalance {
    let credit = 0;
    for (const p of payments) {
      const allocated = p.allocations.reduce(
        (sum, a) => sum + (a.targetVoided ? 0 : a.amount),
        0,
      );
      credit += p.amount - allocated;
    }
    return new CreditBalance(Math.max(0, credit));
  }

  toNumber(): number {
    return this.amount;
  }
}
