import "server-only";
import { ChatMemoryRepository } from "./memory.repository";
import { FarmsService } from "@/features/farms/server";
import { LotsService } from "@/features/lots/server";
import { PricingService } from "@/features/pricing/server";
import { normalizeRole } from "./agent.utils";
import type { AgentMode } from "./agent.validation";
import type {
  AgentResponse,
  AnalyzeBalanceSheetResponse,
  AnalyzeIncomeStatementResponse,
} from "./agent.types";
import { executeBalanceSheetAnalysis } from "./modes/balance-sheet-analysis";
import { executeIncomeStatementAnalysis } from "./modes/income-statement-analysis";
import { executeJournalEntryAiMode } from "./modes/journal-entry-ai";
import { executeChatMode } from "./modes/chat";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatementCurrent,
} from "@/features/accounting/financial-statements/financial-statements.types";

/**
 * Facade orquestador del agente de IA. Mantiene el contrato público estable
 * (server.ts barrel + tests) y delega cada modo a su módulo bajo `./modes/`.
 *
 * Las dependencias stateful del modo chat (memoryRepo + 3 servicios) viven
 * acá como propiedades privadas; el resto de modos son one-shot y resuelven
 * sus dependencias internamente.
 */
export class AgentService {
  private readonly memoryRepo = new ChatMemoryRepository();
  private readonly farmsService = new FarmsService();
  private readonly lotsService = new LotsService();
  private readonly pricingService = new PricingService();

  async query(
    orgId: string,
    userId: string,
    role: string,
    prompt: string,
    sessionId?: string,
    mode: AgentMode = "chat",
    contextHints?: unknown,
  ): Promise<AgentResponse> {
    const normalizedRole = normalizeRole(role);

    if (mode === "journal-entry-ai") {
      return executeJournalEntryAiMode({
        orgId,
        userId,
        role: normalizedRole,
        prompt,
        rawContextHints: contextHints,
      });
    }

    return executeChatMode(
      {
        memoryRepo: this.memoryRepo,
        farmsService: this.farmsService,
        lotsService: this.lotsService,
        pricingService: this.pricingService,
      },
      {
        orgId,
        userId,
        role: normalizedRole,
        prompt,
        sessionId,
      },
    );
  }

  async analyzeBalanceSheet(
    orgId: string,
    userId: string,
    role: string,
    balance: BalanceSheet,
  ): Promise<AnalyzeBalanceSheetResponse> {
    return executeBalanceSheetAnalysis({
      orgId,
      userId,
      role: normalizeRole(role),
      balance,
    });
  }

  async analyzeIncomeStatement(
    orgId: string,
    userId: string,
    role: string,
    is: IncomeStatementCurrent,
    bg: BalanceSheetCurrent,
  ): Promise<AnalyzeIncomeStatementResponse> {
    return executeIncomeStatementAnalysis({
      orgId,
      userId,
      role: normalizeRole(role),
      is,
      bg,
    });
  }
}
