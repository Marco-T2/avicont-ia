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
  };
  journalsByVoucherType: Array<{
    code: string;
    name: string;
    count: number;
    totalDebit: number;
  }>;
}

export interface CloseResult {
  dispatches: number;
  payments: number;
  journalEntries: number;
  periodStatus: string;
}
