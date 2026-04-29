import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

export interface PaymentAllocationSummaryProps {
  id: string;
  paymentId: string;
  amount: MonetaryAmount;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
}

export class PaymentAllocationSummary {
  private constructor(private readonly props: PaymentAllocationSummaryProps) {}

  static fromPersistence(
    props: PaymentAllocationSummaryProps,
  ): PaymentAllocationSummary {
    return new PaymentAllocationSummary(props);
  }

  get id(): string {
    return this.props.id;
  }
  get paymentId(): string {
    return this.props.paymentId;
  }
  get amount(): MonetaryAmount {
    return this.props.amount;
  }
  get payment(): { id: string; date: Date; description: string } {
    return this.props.payment;
  }
}
