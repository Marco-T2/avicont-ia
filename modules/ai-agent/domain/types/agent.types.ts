import type { ExpenseCategory } from "@/generated/prisma/enums";
import type { TrivialityCode } from "../prompts/balance-sheet-analysis.prompt";
import type { IncomeStatementTrivialityCode } from "../prompts/income-statement-analysis.prompt";
import type { JournalEntryAiTemplate } from "../validation/agent.validation";

// ── Agent response types ──

export interface AgentResponse {
  message: string;
  suggestion: AgentSuggestion | null;
  requiresConfirmation: boolean;
}

// ── Balance-sheet analysis response ──

export type AnalyzeBalanceSheetResponse =
  | { status: "ok"; analysis: string }
  | { status: "trivial"; code: TrivialityCode; reason: string }
  | { status: "error"; reason: string };

// ── Income-statement analysis response ──

export type AnalyzeIncomeStatementResponse =
  | { status: "ok"; analysis: string }
  | { status: "trivial"; code: IncomeStatementTrivialityCode; reason: string }
  | { status: "error"; reason: string };

// ── Suggestion types for each action ──

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

// ── Crear asiento contable con IA (modo journal-entry-ai) ────────────────────

export type JournalEntryAiVoucherTypeCode = "CE" | "CI";

export interface ResolvedAccountInfo {
  code: string;
  name: string;
  requiresContact: boolean;
}

export interface ResolvedContactInfo {
  id: string;
  name: string;
  nit: string | null;
}

export interface CreateJournalEntrySuggestion {
  action: "createJournalEntry";
  data: {
    template: JournalEntryAiTemplate;
    voucherTypeCode: JournalEntryAiVoucherTypeCode;
    date: string;
    description: string;
    amount: number;
    contactId?: string;
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
    }>;
    originalText: string;
    resolvedAccounts: Record<string, ResolvedAccountInfo>;
    resolvedContact?: ResolvedContactInfo;
  };
}

export type AgentSuggestion =
  | CreateExpenseSuggestion
  | LogMortalitySuggestion
  | GetLotSummarySuggestion
  | ListFarmsSuggestion
  | ListLotsSuggestion
  | GetTrialBalanceSuggestion
  | GetAccountLedgerSuggestion
  | ListAccountsSuggestion
  | CreateJournalEntrySuggestion;
