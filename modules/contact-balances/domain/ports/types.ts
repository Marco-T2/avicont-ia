export interface OpenAggregate {
  totalBalance: number;
  count: number;
}

export interface PendingDocumentSnapshot {
  id: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}

export interface PaymentForCreditCalc {
  amount: number;
  allocations: AllocationForCreditCalc[];
}

export interface AllocationForCreditCalc {
  amount: number;
  targetVoided: boolean;
}
