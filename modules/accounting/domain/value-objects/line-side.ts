import { Money } from "@/modules/shared/domain/value-objects/money";
import { JournalLineZeroAmount } from "../errors/journal-errors";

export type LineSideKind = "DEBIT" | "CREDIT";

/**
 * Tagged VO that encodes I10 — a journal line is EITHER debit-side OR
 * credit-side, never both, never neither, never zero. Both-sides is impossible
 * by construction (only one factory can be called at a time); zero is rejected
 * in the factories with JournalLineZeroAmount.
 */
export class LineSide {
  private constructor(
    public readonly kind: LineSideKind,
    public readonly amount: Money,
  ) {}

  static debit(amount: Money): LineSide {
    if (amount.isZero()) {
      throw new JournalLineZeroAmount();
    }
    return new LineSide("DEBIT", amount);
  }

  static credit(amount: Money): LineSide {
    if (amount.isZero()) {
      throw new JournalLineZeroAmount();
    }
    return new LineSide("CREDIT", amount);
  }

  get debit(): Money | null {
    return this.kind === "DEBIT" ? this.amount : null;
  }

  get credit(): Money | null {
    return this.kind === "CREDIT" ? this.amount : null;
  }

  equals(other: LineSide): boolean {
    return this.kind === other.kind && this.amount.equals(other.amount);
  }
}
