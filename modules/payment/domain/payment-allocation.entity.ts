import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { AllocationTarget } from "./value-objects/allocation-target";
import { AllocationMustBePositive } from "./errors/payment-errors";

export interface PaymentAllocationProps {
  id: string;
  paymentId: string;
  target: AllocationTarget;
  amount: MonetaryAmount;
}

export interface CreatePaymentAllocationInput {
  paymentId: string;
  target: AllocationTarget;
  amount: number | string;
}

export interface PaymentAllocationSnapshot {
  id: string;
  paymentId: string;
  receivableId: string | null;
  payableId: string | null;
  amount: number;
}

/**
 * Child entity of the Payment aggregate. Has its own identity (DB id) so audit
 * logs and other external references can point at a specific allocation, but
 * is always reached through the Payment aggregate root for mutations.
 *
 * Invariants enforced at construction:
 *   - amount > 0 (PAYMENT_ALLOCATION_MUST_BE_POSITIVE)
 *   - target is XOR receivable/payable (encoded in AllocationTarget VO)
 *
 * Per-payment invariants (homogeneity, sum ≤ payment.amount) live on the
 * Payment aggregate, not here.
 */
export class PaymentAllocation {
  private constructor(private readonly props: PaymentAllocationProps) {}

  static create(input: CreatePaymentAllocationInput): PaymentAllocation {
    const amount = MonetaryAmount.of(input.amount);
    if (!amount.isGreaterThan(MonetaryAmount.zero())) {
      throw new AllocationMustBePositive();
    }
    return new PaymentAllocation({
      id: crypto.randomUUID(),
      paymentId: input.paymentId,
      target: input.target,
      amount,
    });
  }

  static fromPersistence(props: PaymentAllocationProps): PaymentAllocation {
    return new PaymentAllocation(props);
  }

  get id(): string {
    return this.props.id;
  }
  get paymentId(): string {
    return this.props.paymentId;
  }
  get target(): AllocationTarget {
    return this.props.target;
  }
  get amount(): MonetaryAmount {
    return this.props.amount;
  }
  get receivableId(): string | null {
    return this.props.target.receivableId;
  }
  get payableId(): string | null {
    return this.props.target.payableId;
  }

  toSnapshot(): PaymentAllocationSnapshot {
    return {
      id: this.props.id,
      paymentId: this.props.paymentId,
      receivableId: this.props.target.receivableId,
      payableId: this.props.target.payableId,
      amount: this.props.amount.value,
    };
  }
}
