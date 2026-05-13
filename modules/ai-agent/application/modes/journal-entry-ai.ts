import type {
  ToolCall,
  TokenUsage,
  LLMProviderPort,
} from "../../domain/ports/llm-provider.port";
import type { AccountsLookupPort } from "../../domain/ports/accounts-lookup.port";
import type { Role } from "@/modules/permissions/domain/permissions";
import type { AgentResponse } from "../../domain/types/agent.types";
import type { InvocationOutcome } from "../../domain/agent-utils";

export interface JournalEntryAiModeDeps {
  llmProvider: LLMProviderPort;
  accountsLookup: AccountsLookupPort;
}

export interface JournalEntryAiModeArgs {
  orgId: string;
  userId: string;
  role: Role;
  prompt: string;
  rawContextHints: unknown;
}

interface ZodIssueShape {
  path?: ReadonlyArray<string | number>;
  message?: string;
  code?: string;
}

function formatZodIssues(raw: unknown): Array<{ path: string; code?: string; message?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).map((i) => {
    const issue = (i ?? {}) as ZodIssueShape;
    return {
      path: Array.isArray(issue.path) ? issue.path.join(".") : "",
      ...(issue.code ? { code: issue.code } : {}),
      ...(issue.message ? { message: issue.message } : {}),
    };
  });
}

function safeJson(value: unknown): string {
  try {
    const json = JSON.stringify(value, (_k, v) =>
      typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v,
    );
    if (!json) return "[empty]";
    return json.length > 2000 ? `${json.slice(0, 2000)}…` : json;
  } catch {
    return "[unserializable]";
  }
}

/**
 * Modo "captura asistida de asientos contables" del botón "+ Crear Asiento con IA".
 *
 * REQ-005: LLMProviderPort vía deps — singleton llmClient ELIMINADO.
 * REQ-004: AccountsLookupPort vía deps — no PrismaAccountsRepo direct.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeJournalEntryAiMode(
  deps: JournalEntryAiModeDeps,
  args: JournalEntryAiModeArgs,
): Promise<AgentResponse> {
  const [
    { journalEntryAiTools },
    { buildJournalEntryAiSystemPrompt, coerceContextHints },
    { executeParseAccountingOperation },
    { AppError },
    { logStructured },
  ] = await Promise.all([
    import("../../domain/tools/agent.tool-definitions.ts"),
    import("../../domain/prompts/journal-entry-ai.prompt.ts"),
    import("../tools/parse-operation.ts"),
    import("@/features/shared/errors"),
    import("@/lib/logging/structured"),
  ]);

  const { llmProvider, accountsLookup } = deps;
  const { orgId, userId, role, prompt, rawContextHints } = args;
  const startedAt = performance.now();

  let outcome: InvocationOutcome = "ok";
  let usage: TokenUsage | undefined;
  let toolCalls: readonly ToolCall[] = [];
  let errorMessage: string | undefined;
  let errorStack: string | undefined;
  let parsedTemplate: string | undefined;

  const hints = coerceContextHints(rawContextHints);
  const isCorrection = hints?.formState !== undefined;

  if (isCorrection) {
    logStructured({
      event: "journal_ai_correction",
      level: "info",
      orgId,
      userId,
      role,
    });
  }

  try {
    const systemPrompt = buildJournalEntryAiSystemPrompt(hints);

    const result = await llmProvider.query({
      systemPrompt,
      userMessage: prompt,
      tools: journalEntryAiTools,
    });

    usage = result.usage;
    toolCalls = result.toolCalls;

    if (toolCalls.length === 0) {
      outcome = "no_tool_call";
      return {
        message: result.text || "No pude procesar la operación. Reformulá el pedido.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    if (toolCalls.length > 1) {
      logStructured({
        event: "multiple_tool_calls_dropped",
        level: "warn",
        mode: "journal-entry-ai",
        count: toolCalls.length,
        dropped: toolCalls.slice(1).map((c) => c.name),
      });
    }

    const call = toolCalls[0];

    if (call.name !== "parseAccountingOperationToSuggestion") {
      outcome = "unexpected_tool";
      logStructured({
        event: "journal_ai_unexpected_tool",
        level: "warn",
        orgId,
        userId,
        tool: call.name,
      });
      return {
        message: "Hubo un error procesando la operación. Reformulá el pedido.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    const formStateOriginalText =
      hints?.formState && typeof hints.formState === "object"
        ? (hints.formState as Record<string, unknown>).originalText
        : undefined;
    const inheritedOriginalText =
      typeof formStateOriginalText === "string" && formStateOriginalText.length > 0
        ? formStateOriginalText
        : prompt;
    const enrichedInput: Record<string, unknown> = {
      ...((call.input ?? {}) as Record<string, unknown>),
      originalText: inheritedOriginalText,
    };
    try {
      const suggestion = await executeParseAccountingOperation(
        orgId,
        enrichedInput,
        { accountsLookup },
      );
      parsedTemplate = suggestion.data.template;
      logStructured({
        event: "journal_ai_parsed",
        level: "info",
        orgId,
        userId,
        role,
        template: suggestion.data.template,
        isCorrection,
      });
      return {
        message:
          result.text || "Revisá los datos del asiento y confirmá para crear el borrador.",
        suggestion,
        requiresConfirmation: true,
      };
    } catch (error) {
      outcome = "parse_failed";
      if (error instanceof AppError) {
        errorMessage = error.code ?? error.message;
        const issues = formatZodIssues(error.details?.issues);
        logStructured({
          event: "journal_ai_parse_failed",
          level: "warn",
          mode: "journal-entry-ai",
          orgId,
          userId,
          role,
          errorCode: error.code ?? null,
          errorMessage: error.message,
          issues,
          llmInput: safeJson(call.input),
        });
        return {
          message: error.message,
          suggestion: null,
          requiresConfirmation: false,
        };
      }
      throw error;
    }
  } catch (error) {
    outcome = "error";
    errorMessage = error instanceof Error ? error.message : String(error);
    errorStack = error instanceof Error ? error.stack : undefined;
    return {
      message: "Ocurrió un error al procesar la operación. Intentá de nuevo.",
      suggestion: null,
      requiresConfirmation: false,
    };
  } finally {
    logStructured({
      event: "agent_invocation",
      level: outcome === "error" ? "warn" : "info",
      mode: "journal-entry-ai",
      orgId,
      userId,
      role,
      durationMs: Math.round(performance.now() - startedAt),
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      toolCallsCount: toolCalls.length,
      toolNames: toolCalls.map((c) => c.name),
      outcome,
      isCorrection,
      ...(parsedTemplate ? { template: parsedTemplate } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      ...(errorStack ? { errorStack } : {}),
    });
  }
}
