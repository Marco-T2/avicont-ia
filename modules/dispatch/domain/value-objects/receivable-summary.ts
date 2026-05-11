import type { PaymentAllocationSummary } from "./payment-allocation-summary";

export interface ReceivableSummaryProps {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  allocations: PaymentAllocationSummary[];
}

export class ReceivableSummary {
  private constructor(private readonly props: ReceivableSummaryProps) {}

  static fromPersistence(props: ReceivableSummaryProps): ReceivableSummary {
    return new ReceivableSummary(props);
  }

  get id(): string {
    return this.props.id;
  }
  get amount(): number {
    return this.props.amount;
  }
  get paid(): number {
    return this.props.paid;
  }
  get balance(): number {
    return this.props.balance;
  }
  get status(): string {
    return this.props.status;
  }
  get allocations(): PaymentAllocationSummary[] {
    return [...this.props.allocations];
  }
}
