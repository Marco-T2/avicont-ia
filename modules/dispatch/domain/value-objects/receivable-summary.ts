import type {
  PaymentAllocationSummary,
  PaymentAllocationSummarySnapshot,
} from "./payment-allocation-summary";

export interface ReceivableSummaryProps {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  allocations: PaymentAllocationSummary[];
}

export interface ReceivableSummarySnapshot {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  allocations: PaymentAllocationSummarySnapshot[];
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

  toSnapshot(): ReceivableSummarySnapshot {
    return {
      id: this.props.id,
      amount: this.props.amount,
      paid: this.props.paid,
      balance: this.props.balance,
      status: this.props.status,
      allocations: this.props.allocations.map((a) => a.toSnapshot()),
    };
  }
}
