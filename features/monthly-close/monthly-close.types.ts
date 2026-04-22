export interface CloseRequest {
  organizationId: string;
  periodId: string;
  userId: string;
  justification?: string;
}

export interface CloseResult {
  periodId: string;
  periodStatus: "CLOSED";
  closedAt: Date;
  correlationId: string;
  locked: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
  };
}

export type CloseErrorCode =
  | "PERIOD_NOT_FOUND"
  | "PERIOD_ALREADY_CLOSED"
  | "PERIOD_HAS_DRAFT_ENTRIES"
  | "PERIOD_UNBALANCED";

export interface MonthlyCloseSummary {
  periodId: string;
  periodStatus: string;
  posted: {
    dispatches: number;
    payments: number;
    journalEntries: number;
  };
  drafts: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
  };
  journalsByVoucherType: Array<{
    code: string;
    name: string;
    count: number;
    totalDebit: number;
  }>;
  balance: {
    balanced: boolean;
    totalDebit: string;
    totalCredit: string;
    difference: string;
  };
}
