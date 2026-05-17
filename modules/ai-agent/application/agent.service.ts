import type { AgentMode } from "../domain/validation/agent.validation";
import type { Surface } from "../domain/tools/surfaces/surface.types";
import type { ModuleHintValue } from "../domain/types/module-hint.types";
import type {
  AgentResponse,
  AnalyzeBalanceSheetResponse,
  AnalyzeIncomeStatementResponse,
} from "../domain/types/agent.types";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatementCurrent,
} from "@/modules/accounting/financial-statements/presentation";

import type { LLMProviderPort } from "../domain/ports/llm-provider.port";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port";
import type { AccountsLookupPort } from "../domain/ports/accounts-lookup.port";
import type { RagPort } from "../domain/ports/rag.port";
import type { FarmInquiryPort } from "@/modules/farm/presentation/server";
import type { LotInquiryPort } from "@/modules/lot/presentation/server";
import type { AccountingQueryPort } from "../domain/ports/accounting-query.port";

import type { AgentRateLimitService } from "./rate-limit.service";
import type { PricingService } from "./pricing/pricing.service";

/**
 * AgentServiceDeps — port-injected dependency object.
 *
 * REQ-005: LLMProviderPort eliminates the llmClient module singleton — the
 * concrete adapter (GeminiLLMAdapter) is wired at the composition root
 * (presentation/server.ts at C3).
 * REQ-004: AccountsLookupPort + RagPort decouple the application layer from
 * PrismaAccountsRepo / features/documents/rag — adapters land at C2.
 */
export interface AgentServiceDeps {
  readonly llmProvider: LLMProviderPort;
  readonly chatMemory: ChatMemoryPort;
  readonly contextReader: AgentContextReaderPort;
  readonly rateLimit: AgentRateLimitService;
  readonly accountsLookup: AccountsLookupPort;
  readonly rag: RagPort;
  readonly farmInquiry: FarmInquiryPort;
  readonly lotInquiry: LotInquiryPort;
  readonly pricingService: PricingService;
  readonly accountingQuery: AccountingQueryPort;
}

/**
 * Facade orquestador del agente de IA. Delegates each mode to its module.
 * Paired sister: modules/dispatch/application/dispatch.service.ts ctor pattern.
 *
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export class AgentService {
  private readonly deps: AgentServiceDeps;

  constructor(deps: AgentServiceDeps) {
    this.deps = deps;
  }

  async query(
    orgId: string,
    userId: string,
    role: string,
    prompt: string,
    sessionId: string | undefined,
    surface: Surface,
    mode: AgentMode = "chat",
    contextHints?: unknown,
    // moduleHint added as the 9th positional arg AFTER contextHints to keep
    // all existing F1 positional mock assertions stable (route surface-
    // validation test asserts callArgs[5] === 'sidebar-qa'). Deviates from
    // design D3.1 which proposed slotting after `mode`; safer here.
    moduleHint: ModuleHintValue = null,
  ): Promise<AgentResponse> {
    const { normalizeRole } = await import("../domain/agent-utils.ts");
    const normalizedRole = normalizeRole(role);

    if (mode === "journal-entry-ai") {
      const { executeJournalEntryAiMode } = await import("./modes/journal-entry-ai.ts");
      return executeJournalEntryAiMode(
        {
          llmProvider: this.deps.llmProvider,
          accountsLookup: this.deps.accountsLookup,
        },
        {
          orgId,
          userId,
          role: normalizedRole,
          prompt,
          rawContextHints: contextHints,
        },
      );
    }

    const { executeChatMode } = await import("./modes/chat.ts");
    return executeChatMode(
      {
        llmProvider: this.deps.llmProvider,
        chatMemory: this.deps.chatMemory,
        contextReader: this.deps.contextReader,
        rag: this.deps.rag,
        farmInquiry: this.deps.farmInquiry,
        lotInquiry: this.deps.lotInquiry,
        pricingService: this.deps.pricingService,
        accountingQuery: this.deps.accountingQuery,
      },
      {
        orgId,
        userId,
        role: normalizedRole,
        prompt,
        surface,
        sessionId,
        contextHints,
        moduleHint,
      },
    );
  }

  async analyzeBalanceSheet(
    orgId: string,
    userId: string,
    role: string,
    balance: BalanceSheet,
  ): Promise<AnalyzeBalanceSheetResponse> {
    const [{ normalizeRole }, { executeBalanceSheetAnalysis }] = await Promise.all([
      import("../domain/agent-utils.ts"),
      import("./modes/balance-sheet-analysis.ts"),
    ]);
    return executeBalanceSheetAnalysis(
      { llmProvider: this.deps.llmProvider },
      {
        orgId,
        userId,
        role: normalizeRole(role),
        balance,
      },
    );
  }

  async analyzeIncomeStatement(
    orgId: string,
    userId: string,
    role: string,
    is: IncomeStatementCurrent,
    bg: BalanceSheetCurrent,
  ): Promise<AnalyzeIncomeStatementResponse> {
    const [{ normalizeRole }, { executeIncomeStatementAnalysis }] = await Promise.all([
      import("../domain/agent-utils.ts"),
      import("./modes/income-statement-analysis.ts"),
    ]);
    return executeIncomeStatementAnalysis(
      { llmProvider: this.deps.llmProvider },
      {
        orgId,
        userId,
        role: normalizeRole(role),
        is,
        bg,
      },
    );
  }
}
