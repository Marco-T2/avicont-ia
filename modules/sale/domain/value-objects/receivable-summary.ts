import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { PaymentAllocationSummary } from "./payment-allocation-summary";

export interface ReceivableSummaryProps {
  id: string;
  amount: MonetaryAmount;
  paid: MonetaryAmount;
  balance: MonetaryAmount;
  status: string;
  dueDate: Date;
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
  get amount(): MonetaryAmount {
    return this.props.amount;
  }
  get paid(): MonetaryAmount {
    return this.props.paid;
  }
  get balance(): MonetaryAmount {
    return this.props.balance;
  }
  get status(): string {
    return this.props.status;
  }
  get dueDate(): Date {
    return this.props.dueDate;
  }
  get allocations(): PaymentAllocationSummary[] {
    return [...this.props.allocations];
  }
}
