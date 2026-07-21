import type { TokenUsage, LLMProviderPort } from "../../domain/ports/llm-provider.port";
import type { Role } from "@/modules/permissions/domain/permissions";
import type { AnalyzeBalanceSheetResponse } from "../../domain/types/agent.types";
import type { BalanceSheet } from "@/modules/accounting/financial-statements/presentation";

export interface BalanceSheetAnalysisDeps {
  llmProvider: LLMProviderPort;
}

export interface BalanceSheetAnalysisArgs {
  orgId: string;
  userId: string;
  role: Role;
  balance: BalanceSheet;
}

/**
 * Analiza un Balance General produciendo cálculo + interpretación de ratios
 * financieros estándar. One-shot: sin tools, sin RAG, sin historial.
 *
 * REQ-005: LLMProviderPort vía deps — singleton llmClient ELIMINADO.
 *
 * Value imports are intentionally deferred via dynamic import() so the
 * module is loadable in Node strip-types contexts (c1 sentinel require()).
 * At production / test runtime via vite-node, dynamic import() resolves
 * normally through the configured aliases.
 */
export async function executeBalanceSheetAnalysis(
  deps: BalanceSheetAnalysisDeps,
  args: BalanceSheetAnalysisArgs,
): Promise<AnalyzeBalanceSheetResponse> {
  const [
    { BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT, checkBalanceTriviality, curateBalanceSheetForLLM, formatBalanceSheetUserMessage },
    { logStructured },
  ] = await Promise.all([
    import("../../domain/prompts/balance-sheet-analysis.prompt.ts"),
    import("@/lib/logging/structured"),
  ]);

  const { llmProvider } = deps;
  const { orgId, userId, role, balance } = args;
  const startedAt = performance.now();

  let outcome: "ok" | "trivial" | "error" = "ok";
  let usage: TokenUsage | undefined;
  let trivialCode: string | undefined;
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    const triviality = checkBalanceTriviality(balance);
    if (triviality.trivial) {
      outcome = "trivial";
      trivialCode = triviality.code;
      return {
        status: "trivial",
        code: triviality.code,
        reason: triviality.reason,
      };
    }

    const curated = curateBalanceSheetForLLM(balance);
    const userMessage = formatBalanceSheetUserMessage(curated);

    const result = await llmProvider.query({
      systemPrompt: BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
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
      mode: "balance-sheet-analysis",
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
