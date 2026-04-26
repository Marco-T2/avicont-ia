import "server-only";
import { llmClient, type ToolCall, type TokenUsage } from "../llm";
import { journalEntryAiTools } from "../agent.tools";
import {
  buildJournalEntryAiSystemPrompt,
  coerceContextHints,
} from "../journal-entry-ai.prompt";
import { executeParseAccountingOperation } from "../tools";
import { AppError } from "@/features/shared/errors";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";
import type { AgentResponse } from "../agent.types";
import type { InvocationOutcome } from "../agent.utils";

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

// Serializa hasta 5 issues como objetos chicos (path/code/message). El payload
// completo de Zod es ruidoso (contiene `received`, `expected`, schemas
// anidados); 5 issues * 3 campos alcanza para diagnóstico sin inflar logs.
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

// Stringifica el input del LLM con guardas: nunca tira por circulares, recorta
// strings >300 chars (originalText puede ser largo), trunca el output total a
// 2KB. Devuelve "[unserializable]" si todo falla.
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
 * Single-turn, single-tool: el LLM tiene acceso únicamente a
 * parseAccountingOperationToSuggestion. El catálogo de cuentas y proveedores
 * viaja precargado en el system prompt vía contextHints — sin RAG, sin context
 * de granjas/lotes, sin historial. Cada modal arranca limpio (stateless v1);
 * la "memoria" del flow son los contextHints.formState que el frontend manda
 * explícitamente cuando el usuario corrige en lenguaje natural.
 */
export async function executeJournalEntryAiMode(
  args: JournalEntryAiModeArgs,
): Promise<AgentResponse> {
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

    const result = await llmClient.query({
      systemPrompt,
      userMessage: prompt,
      tools: journalEntryAiTools,
    });

    usage = result.usage;
    toolCalls = result.toolCalls;

    // Sin tool call: el LLM decidió responder al usuario (pidiendo aclaración,
    // o rechazando la operación por no encajar en las plantillas).
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

    // En este modo el LLM solo debería llamar parseAccountingOperationToSuggestion.
    // Cualquier otra tool es un bug del system prompt o del modelo.
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

    // Builder: valida con Zod, hace lookup batch, construye lines, devuelve
    // CreateJournalEntrySuggestion. Errores tipados (ValidationError) son
    // esperables — vuelven al usuario como mensaje sin tirar la respuesta.
    //
    // `originalText` se inyecta server-side, NO viene del LLM. Razón: es el
    // texto crudo del usuario para audit/display — el servidor lo conoce
    // (prompt actual o formState.originalText en correcciones), el LLM no
    // tiene incentivo natural para copiarlo byte por byte y tampoco sabe
    // distinguir entre "primer pedido" y "corrección" para preservarlo.
    // Override final: lo que sea que el LLM mandara en originalText queda
    // ignorado.
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
      const suggestion = await executeParseAccountingOperation(orgId, enrichedInput);
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
        // ValidationError esperable — el LLM proveyó algo inválido (ID inexistente,
        // cuenta sin requiresContact, etc.). Devolvemos el mensaje al usuario.
        // Para diagnóstico: serializamos las Zod issues (path + message) + un dump
        // del input que el LLM mandó. Útil para detectar patrones de alucinación
        // (IDs inventados, campos extra, formato de fecha, etc.) sin filtrar PII
        // al usuario — todo va al log estructurado, no a la respuesta. Mantenemos
        // `errorMessage` en agent_invocation con el code corto (backward compat
        // con dashboards y tests existentes); el detalle vive en el evento nuevo.
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
