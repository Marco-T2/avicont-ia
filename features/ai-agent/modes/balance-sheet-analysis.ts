import "server-only";
import { llmClient, type TokenUsage } from "../llm";
import {
  BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
  checkBalanceTriviality,
  curateBalanceSheetForLLM,
  formatBalanceSheetUserMessage,
} from "../balance-sheet-analysis.prompt";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";
import type { AnalyzeBalanceSheetResponse } from "../agent.types";
import type { BalanceSheet } from "@/features/accounting/financial-statements/financial-statements.types";

export interface BalanceSheetAnalysisArgs {
  orgId: string;
  userId: string;
  role: Role;
  balance: BalanceSheet;
}

/**
 * Analiza un Balance General produciendo cálculo + interpretación de ratios
 * financieros estándar. One-shot: sin tools, sin RAG, sin historial. Reusa
 * la misma capa de telemetría (`agent_invocation`) que `query()` con
 * `mode: "balance-sheet-analysis"` para distinguir buckets en logs.
 */
export async function executeBalanceSheetAnalysis(
  args: BalanceSheetAnalysisArgs,
): Promise<AnalyzeBalanceSheetResponse> {
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

    const result = await llmClient.query({
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
      reason:
        "Ocurrió un error al generar el análisis. Intente nuevamente.",
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
