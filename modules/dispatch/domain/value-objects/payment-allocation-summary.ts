export interface PaymentAllocationSummaryProps {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
}

export interface PaymentAllocationSummarySnapshot {
  id: string;
  paymentId: string;
  amount: number;
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
  get amount(): number {
    return this.props.amount;
  }
  get payment(): { id: string; date: Date; description: string } {
    return this.props.payment;
  }

  toSnapshot(): PaymentAllocationSummarySnapshot {
    return {
      id: this.props.id,
      paymentId: this.props.paymentId,
      amount: this.props.amount,
      payment: {
        id: this.props.payment.id,
        date: this.props.payment.date,
        description: this.props.payment.description,
      },
    };
  }
}
