import type { ExpenseCategory } from "@/generated/prisma/client";

// ── Agent response types ──

export interface AgentResponse {
  message: string;
  suggestion: AgentSuggestion | null;
  requiresConfirmation: boolean;
}

// ── Suggestion types for each action ──

export type AgentAction =
  | "createExpense"
  | "logMortality"
  | "getLotSummary"
  | "listFarms"
  | "listLots"
  | "getTrialBalance"
  | "getAccountLedger"
  | "listAccounts";

export interface CreateExpenseSuggestion {
  action: "createExpense";
  data: {
    amount: number;
    category: ExpenseCategory;
    description?: string;
    lotId: string;
    date: string;
  };
}

export interface LogMortalitySuggestion {
  action: "logMortality";
  data: {
    count: number;
    cause?: string;
    lotId: string;
    date: string;
  };
}

export interface GetLotSummarySuggestion {
  action: "getLotSummary";
  data: { lotId: string };
}

export interface ListFarmsSuggestion {
  action: "listFarms";
  data: Record<string, never>;
}

export interface ListLotsSuggestion {
  action: "listLots";
  data: { farmId: string };
}

export interface GetTrialBalanceSuggestion {
  action: "getTrialBalance";
  data: { date?: string };
}

export interface GetAccountLedgerSuggestion {
  action: "getAccountLedger";
  data: {
    accountId: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface ListAccountsSuggestion {
  action: "listAccounts";
  data: Record<string, never>;
}

export type AgentSuggestion =
  | CreateExpenseSuggestion
  | LogMortalitySuggestion
  | GetLotSummarySuggestion
  | ListFarmsSuggestion
  | ListLotsSuggestion
  | GetTrialBalanceSuggestion
  | GetAccountLedgerSuggestion
  | ListAccountsSuggestion;

// ── Tool definition type ──

export interface ToolDefinition {
  name: AgentAction;
  description: string;
  parameters: Record<string, unknown>;
}

// ── Confirm request ──

export interface ConfirmActionRequest {
  suggestion: AgentSuggestion;
}
