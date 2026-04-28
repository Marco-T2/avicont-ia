import type { AccountNature } from "@/generated/prisma/client";
import { Money } from "@/modules/shared/domain/value-objects/money";
import { LineSide } from "./value-objects/line-side";

export interface AccountBalanceProps {
  id: string;
  organizationId: string;
  accountId: string;
  periodId: string;
  nature: AccountNature;
  debitTotal: Money;
  creditTotal: Money;
}

export interface CreateAccountBalanceInput {
  organizationId: string;
  accountId: string;
  periodId: string;
  nature: AccountNature;
}

export interface AccountBalanceSnapshot {
  id: string;
  organizationId: string;
  accountId: string;
  periodId: string;
  nature: AccountNature;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

/**
 * AccountBalance is a separate aggregate from Journal. Each instance represents
 * the running totals of one account within one fiscal period. Mutated by
 * journal POST/VOID (multi-aggregate orchestration coordinated by use case +
 * UoW tx in C2), and also independently by other features (receivables,
 * payables, payment); hence its separation from Journal.
 *
 * `nature` is an immutable property of the underlying Account; the aggregate
 * caches it to compute the signed `balance` derived value.
 */
export class AccountBalance {
  private constructor(private readonly props: AccountBalanceProps) {}

  static create(input: CreateAccountBalanceInput): AccountBalance {
    return new AccountBalance({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      accountId: input.accountId,
      periodId: input.periodId,
      nature: input.nature,
      debitTotal: Money.zero(),
      creditTotal: Money.zero(),
    });
  }

  static fromPersistence(props: AccountBalanceProps): AccountBalance {
    return new AccountBalance(props);
  }

  // ── Getters ──

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get accountId(): string {
    return this.props.accountId;
  }
  get periodId(): string {
    return this.props.periodId;
  }
  get nature(): AccountNature {
    return this.props.nature;
  }
  get debitTotal(): Money {
    return this.props.debitTotal;
  }
  get creditTotal(): Money {
    return this.props.creditTotal;
  }

  /**
   * Signed balance derived from totals and nature. Positive when the running
   * totals match the natural side of the account; negative when inverted
   * ("saldo en rojo"). May legitimately be negative — that is why this getter
   * returns `number`, not `Money`.
   */
  get balance(): number {
    return this.props.nature === "DEUDORA"
      ? this.props.debitTotal.signedDiff(this.props.creditTotal)
      : this.props.creditTotal.signedDiff(this.props.debitTotal);
  }

  // ── Mutators ──

  applyLine(side: LineSide): AccountBalance {
    if (side.kind === "DEBIT") {
      return new AccountBalance({
        ...this.props,
        debitTotal: this.props.debitTotal.plus(side.amount),
      });
    }
    return new AccountBalance({
      ...this.props,
      creditTotal: this.props.creditTotal.plus(side.amount),
    });
  }

  revertLine(side: LineSide): AccountBalance {
    if (side.kind === "DEBIT") {
      return new AccountBalance({
        ...this.props,
        debitTotal: this.props.debitTotal.minus(side.amount),
      });
    }
    return new AccountBalance({
      ...this.props,
      creditTotal: this.props.creditTotal.minus(side.amount),
    });
  }

  toSnapshot(): AccountBalanceSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      accountId: this.props.accountId,
      periodId: this.props.periodId,
      nature: this.props.nature,
      debitTotal: this.props.debitTotal.toNumber(),
      creditTotal: this.props.creditTotal.toNumber(),
      balance: this.balance,
    };
  }
}
