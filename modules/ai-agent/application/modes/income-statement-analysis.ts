import type { TokenUsage, LLMProviderPort } from "../../domain/ports/llm-provider.port";
import type { Role } from "@/modules/permissions/domain/permissions";
import type { AnalyzeIncomeStatementResponse } from "../../domain/types/agent.types";
import type {
  BalanceSheetCurrent,
  IncomeStatementCurrent,
} from "@/features/accounting/financial-statements/financial-statements.types";

export interface IncomeStatementAnalysisDeps {
  llmProvider: LLMProviderPort;
}

export interface IncomeStatementAnalysisArgs {
  orgId: string;
  userId: string;
  role: Role;
  is: IncomeStatementCurrent;
  bg: BalanceSheetCurrent;
}

/**
 * Analiza un Estado de Resultados con su Balance General cruzado al cierre.
 * One-shot: sin tools, sin RAG, sin historial.
 *
 * REQ-005: LLMProviderPort vía deps — singleton llmClient ELIMINADO.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeIncomeStatementAnalysis(
  deps: IncomeStatementAnalysisDeps,
  args: IncomeStatementAnalysisArgs,
): Promise<AnalyzeIncomeStatementResponse> {
  const [
    { INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT, checkIncomeStatementTriviality, curateIncomeStatementForLLM, formatIncomeStatementUserMessage },
    { logStructured },
  ] = await Promise.all([
    import("../../domain/prompts/income-statement-analysis.prompt.ts"),
    import("@/lib/logging/structured"),
  ]);

  const { llmProvider } = deps;
  const { orgId, userId, role, is, bg } = args;
  const startedAt = performance.now();

  let outcome: "ok" | "trivial" | "error" = "ok";
  let usage: TokenUsage | undefined;
  let trivialCode: string | undefined;
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    const triviality = checkIncomeStatementTriviality(is, bg);
    if (triviality.trivial) {
      outcome = "trivial";
      trivialCode = triviality.code;
      return {
        status: "trivial",
        code: triviality.code,
        reason: triviality.reason,
      };
    }

    const curated = curateIncomeStatementForLLM(is, bg);
    const userMessage = formatIncomeStatementUserMessage(curated);

    const result = await llmProvider.query({
      systemPrompt: INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT,
      userMessage,
      tools: [],
    });

    usage = result.usage;

    const text = result.text.trim();
    if (!text) {
      outcome = "error";
      errorMessage = "empty_llm_response";
      return {
        status: "error",
        reason: "El modelo no devolvió un análisis. Intente nuevamente.",
      };
    }

    return { status: "ok", analysis: text };
  } catch (error) {
    outcome = "error";
    errorMessage = error instanceof Error ? error.message : String(error);
    errorStack = error instanceof Error ? error.stack : undefined;
    return {
      status: "error",
      reason: "Ocurrió un error al generar el análisis. Intente nuevamente.",
    };
  } finally {
    logStructured({
      event: "agent_invocation",
      level: outcome === "error" ? "warn" : "info",
      mode: "income-statement-analysis",
      orgId,
      userId,
      role,
      durationMs: Math.round(performance.now() - startedAt),
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      outcome,
      ...(trivialCode ? { trivialCode } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      ...(errorStack ? { errorStack } : {}),
    });
  }
}
