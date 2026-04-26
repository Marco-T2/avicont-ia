import "server-only";
import { llmClient, type ToolCall, type TokenUsage } from "./llm";
import {
  getToolsForRole,
  isWriteAction,
  journalEntryAiTools,
  TOOL_REGISTRY,
} from "./agent.tools";
import { buildAgentContext, buildRagContext } from "./agent.context";
import { ChatMemoryRepository } from "./memory.repository";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";
import type { AgentMode } from "./agent.validation";
import type {
  AgentResponse,
  AgentSuggestion,
  AnalyzeBalanceSheetResponse,
  AnalyzeIncomeStatementResponse,
} from "./agent.types";
import {
  BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
  checkBalanceTriviality,
  curateBalanceSheetForLLM,
  formatBalanceSheetUserMessage,
} from "./balance-sheet-analysis.prompt";
import {
  INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT,
  checkIncomeStatementTriviality,
  curateIncomeStatementForLLM,
  formatIncomeStatementUserMessage,
} from "./income-statement-analysis.prompt";
import {
  buildJournalEntryAiSystemPrompt,
  coerceContextHints,
} from "./journal-entry-ai.prompt";
import { executeParseAccountingOperation } from "./tools";
import { AppError } from "@/features/shared/errors";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatementCurrent,
} from "@/features/accounting/financial-statements/financial-statements.types";

type InvocationOutcome =
  | "ok"
  | "error"
  | "validation_failed"
  | "no_tools_for_role"
  | "no_tool_call"
  | "unexpected_tool"
  | "parse_failed";

const memoryRepo = new ChatMemoryRepository();

type AgentLabel = "socio" | "contador" | "admin";

const AGENT_ROLE_LABELS: Record<Role, AgentLabel> = {
  owner: "admin",
  admin: "admin",
  contador: "contador",
  cobrador: "socio",
  member: "socio",
};

// ── Ejecutores de herramientas de solo lectura ──

import { FarmsService } from "@/features/farms/server";
import { LotsService } from "@/features/lots/server";
import { PricingService } from "@/features/pricing/server";

const farmsService = new FarmsService();
const lotsService = new LotsService();
const pricingService = new PricingService();

// ── Helpers de telemetría para journal-entry-ai parse failures ──

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

export class AgentService {
  /**
   * Procesar un mensaje en lenguaje natural del usuario y retornar una respuesta estructurada.
   * Las acciones de escritura NUNCA se ejecutan directamente — retornan una sugerencia para confirmación.
   */
  async query(
    orgId: string,
    userId: string,
    role: string,
    prompt: string,
    sessionId?: string,
    mode: AgentMode = "chat",
    contextHints?: unknown,
  ): Promise<AgentResponse> {
    // El modo journal-entry-ai vive en su propio método — flow distinto:
    // single-turn, single-tool, sin RAG/context/history, catálogo precargado
    // en system prompt vía contextHints.
    if (mode === "journal-entry-ai") {
      return this.queryJournalEntryAi(orgId, userId, role, prompt, contextHints);
    }

    const startedAt = performance.now();
    const normalizedRole = this.normalizeRole(role);

    let outcome: InvocationOutcome = "ok";
    let usage: TokenUsage | undefined;
    let toolCalls: readonly ToolCall[] = [];
    let errorMessage: string | undefined;
    let errorStack: string | undefined;

    try {
      const tools = getToolsForRole(normalizedRole);

      if (tools.length === 0) {
        outcome = "no_tools_for_role";
        return {
          message: "No tienes herramientas disponibles para tu rol actual.",
          suggestion: null,
          requiresConfirmation: false,
        };
      }

      const [context, ragContext, history] = await Promise.all([
        buildAgentContext(orgId, userId, normalizedRole),
        buildRagContext(orgId, prompt, normalizedRole),
        sessionId ? memoryRepo.getRecentMessages(orgId, sessionId) : Promise.resolve([]),
      ]);

      const fullContext = ragContext ? `${ragContext}\n\n${context}` : context;

      let historyContext = "";
      if (history.length > 0) {
        const historyLines = history.map(
          (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`,
        );
        historyContext = [
          "## Historial de Conversación Reciente",
          "",
          ...historyLines,
          "",
        ].join("\n");
      }

      const contextWithHistory = historyContext
        ? `${historyContext}\n\n${fullContext}`
        : fullContext;
      const systemPrompt = this.buildSystemPrompt(normalizedRole, contextWithHistory);

      // Persistimos el mensaje del usuario DENTRO del try: si falla (DB caída,
      // timeout) queremos cortocircuitar antes de llamar al LLM y devolver
      // el error canned en vez de corromper silenciosamente el historial.
      if (sessionId) {
        await memoryRepo.saveMessage(sessionId, orgId, userId, "user", prompt);
      }

      const result = await llmClient.query({
        systemPrompt,
        userMessage: prompt,
        tools,
      });

      usage = result.usage;
      toolCalls = result.toolCalls;

      if (toolCalls.length > 0) {
        // Hoy procesamos solo la primera tool call. Los modelos modernos
        // (Gemini 2.5, Claude, GPT-4) pueden devolver varias en paralelo;
        // cuando empiece a aparecer queremos verlo en logs antes de que un
        // usuario reporte un bug raro de "el agente ignoró parte de mi pedido".
        if (toolCalls.length > 1) {
          logStructured({
            event: "multiple_tool_calls_dropped",
            level: "warn",
            count: toolCalls.length,
            dropped: toolCalls.slice(1).map((c) => c.name),
          });
        }

        const call = toolCalls[0];

        if (isWriteAction(call.name)) {
          const exec = await this.handleWriteCall(call, result.text);
          outcome = exec.outcome;
          if (sessionId) {
            await memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", exec.response.message);
          }
          return exec.response;
        }

        const exec = await this.handleReadCall(
          orgId,
          normalizedRole,
          call,
          result.text,
        );
        outcome = exec.outcome;
        if (sessionId) {
          await memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", exec.response.message);
        }
        return exec.response;
      }

      const message = result.text || "No pude procesar tu solicitud.";
      if (sessionId) {
        await memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", message);
      }
      return {
        message,
        suggestion: null,
        requiresConfirmation: false,
      };
    } catch (error) {
      outcome = "error";
      errorMessage = error instanceof Error ? error.message : String(error);
      errorStack = error instanceof Error ? error.stack : undefined;
      return {
        message:
          "Ocurrió un error al procesar tu solicitud. Intenta de nuevo.",
        suggestion: null,
        requiresConfirmation: false,
      };
    } finally {
      logStructured({
        event: "agent_invocation",
        level: "info",
        orgId,
        userId,
        role: normalizedRole,
        durationMs: Math.round(performance.now() - startedAt),
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        toolCallsCount: toolCalls.length,
        toolNames: toolCalls.map((c) => c.name),
        outcome,
        ...(errorMessage ? { errorMessage } : {}),
        ...(errorStack ? { errorStack } : {}),
      });
    }
  }

  /**
   * Analiza un Balance General produciendo cálculo + interpretación de ratios
   * financieros estándar. One-shot: sin tools, sin RAG, sin historial. Reusa
   * la misma capa de telemetría (`agent_invocation`) que `query()` con
   * `mode: "balance-sheet-analysis"` para distinguir buckets en logs.
   */
  async analyzeBalanceSheet(
    orgId: string,
    userId: string,
    role: string,
    balance: BalanceSheet,
  ): Promise<AnalyzeBalanceSheetResponse> {
    const startedAt = performance.now();
    const normalizedRole = this.normalizeRole(role);

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
        role: normalizedRole,
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

  /**
   * Analiza un Estado de Resultados con su Balance General cruzado al cierre,
   * produciendo cálculo + interpretación de seis ratios financieros (tres
   * puros sobre el IS y tres cruzados IS × BG). One-shot: sin tools, sin RAG,
   * sin historial. Comparte la capa de telemetría `agent_invocation` con
   * `query()` y `analyzeBalanceSheet()`, distinguiéndose por
   * `mode: "income-statement-analysis"`.
   *
   * A diferencia del análisis del Balance General, los ratios vienen
   * pre-calculados en el JSON curado (single source of truth) y el LLM se
   * limita a interpretarlos.
   */
  async analyzeIncomeStatement(
    orgId: string,
    userId: string,
    role: string,
    is: IncomeStatementCurrent,
    bg: BalanceSheetCurrent,
  ): Promise<AnalyzeIncomeStatementResponse> {
    const startedAt = performance.now();
    const normalizedRole = this.normalizeRole(role);

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

      const result = await llmClient.query({
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
        reason:
          "Ocurrió un error al generar el análisis. Intente nuevamente.",
      };
    } finally {
      logStructured({
        event: "agent_invocation",
        level: outcome === "error" ? "warn" : "info",
        mode: "income-statement-analysis",
        orgId,
        userId,
        role: normalizedRole,
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

  /**
   * Modo "captura asistida de asientos contables" del botón "+ Crear Asiento con IA".
   * Single-turn, single-tool: el LLM tiene acceso únicamente a
   * parseAccountingOperationToSuggestion. El catálogo de cuentas y proveedores
   * viaja precargado en el system prompt vía contextHints — sin RAG, sin context
   * de granjas/lotes, sin historial. Cada modal arranca limpio (stateless v1);
   * la "memoria" del flow son los contextHints.formState que el frontend manda
   * explícitamente cuando el usuario corrige en lenguaje natural.
   */
  private async queryJournalEntryAi(
    orgId: string,
    userId: string,
    role: string,
    prompt: string,
    rawContextHints: unknown,
  ): Promise<AgentResponse> {
    const startedAt = performance.now();
    const normalizedRole = this.normalizeRole(role);

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
        role: normalizedRole,
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
          role: normalizedRole,
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
            role: normalizedRole,
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
        role: normalizedRole,
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

  // ── Helpers privados ──

  private normalizeRole(role: string): Role {
    const lower = role.toLowerCase();
    if (lower === "owner") return "owner";
    if (lower === "admin") return "admin";
    if (lower === "contador" || lower === "accountant") return "contador";
    return "member";
  }

  private buildSystemPrompt(role: Role, context: string): string {
    const roleDescriptions: Record<AgentLabel, string> = {
      socio:
        "Eres un asistente para un socio avicultor. Ayudas a registrar gastos, mortalidad y consultar información sobre sus lotes y granjas.",
      contador:
        "Eres un asistente para un contador. Ayudas a consultar balances, libros mayores y el plan de cuentas.",
      admin:
        "Eres un asistente administrativo con acceso completo. Puedes ayudar tanto con operaciones avícolas como contables.",
    };
    const label = AGENT_ROLE_LABELS[role];

    return [
      "Eres un asistente de IA para Avicont, un sistema de contabilidad avícola.",
      roleDescriptions[label],
      "",
      "REGLAS IMPORTANTES:",
      "- Responde siempre en ESPAÑOL y de forma corta.",
      "- Tu conocimiento contable proviene EXCLUSIVAMENTE de los documentos indexados (RAG). Si no encontrás información relevante en los documentos, decilo claramente. NO inventes datos contables, códigos de cuenta ni información que no esté en los documentos.",
      "- Cuando refieras a una cuenta contable, SIEMPRE incluí el código y el nombre completo. Ejemplo: '1.2.3.1 — Vehículos'. Nunca menciones una cuenta sin su código.",
      "- NUNCA muestres al usuario el contexto RAG, los fragmentos de documentos, ni los datos internos en bruto. Usa esa información para responder de forma natural, pero no la copies textualmente en tu respuesta.",
      "- Si NO se te proporciona un bloque 'Contexto de Documentos (RAG)', significa que no se encontraron documentos relevantes. En ese caso, responde únicamente con los datos estructurados disponibles y, si la pregunta requiere información documental que no tenés, indicalo claramente al usuario en vez de inventar.",
      `- La fecha actual es: ${new Date().toISOString().split("T")[0]}`,
      "",
      "CONTEXTO DE DATOS DISPONIBLES:",
      context,
    ].join("\n");
  }

  /**
   * Resuelve la tool por nombre, valida `call.input` contra el schema Zod
   * registrado, y devuelve el input tipado. Si el LLM alucina args o falta
   * la tool en el registry, devuelve una respuesta de error estructurada.
   */
  private validateToolInput(
    call: ToolCall,
  ):
    | { ok: true; input: Record<string, unknown> }
    | { ok: false; response: AgentResponse } {
    const tool = TOOL_REGISTRY[call.name];
    if (!tool) {
      return {
        ok: false,
        response: {
          message: `Acción no reconocida: ${call.name}`,
          suggestion: null,
          requiresConfirmation: false,
        },
      };
    }

    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      logStructured({
        event: "tool_input_validation_failed",
        level: "warn",
        tool: call.name,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return {
        ok: false,
        response: {
          message: `Los argumentos para ${call.name} no son válidos. Reintentá la consulta.`,
          suggestion: null,
          requiresConfirmation: false,
        },
      };
    }

    return { ok: true, input: parsed.data as Record<string, unknown> };
  }

  private async handleWriteCall(
    call: ToolCall,
    text: string,
  ): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
    const validation = this.validateToolInput(call);
    if (!validation.ok) {
      return { response: validation.response, outcome: "validation_failed" };
    }

    const suggestion: AgentSuggestion = {
      action: call.name as AgentSuggestion["action"],
      data: validation.input,
    } as AgentSuggestion;

    return {
      outcome: "ok",
      response: {
        message:
          text ||
          `Voy a ${call.name === "createExpense" ? "registrar un gasto" : "registrar mortalidad"}. Por favor confirma.`,
        suggestion,
        requiresConfirmation: true,
      },
    };
  }

  private async handleReadCall(
    orgId: string,
    role: Role,
    call: ToolCall,
    text: string,
  ): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
    const validation = this.validateToolInput(call);
    if (!validation.ok) {
      return { response: validation.response, outcome: "validation_failed" };
    }
    const args = validation.input;

    try {
      let data: unknown;

      switch (call.name) {
        case "listFarms":
          data = await farmsService.list(orgId);
          break;
        case "listLots":
          data = await lotsService.listByFarm(orgId, args.farmId as string);
          break;
        case "getLotSummary":
          data = await pricingService.calculateLotCost(
            orgId,
            args.lotId as string,
          );
          break;
        case "searchDocuments": {
          const ragContext = await buildRagContext(orgId, args.query as string, role);
          return {
            outcome: "ok",
            response: {
              message: text || ragContext || "No se encontraron documentos relevantes.",
              suggestion: null,
              requiresConfirmation: false,
            },
          };
        }
        default:
          return {
            outcome: "validation_failed",
            response: {
              message: `Acción no reconocida: ${call.name}`,
              suggestion: null,
              requiresConfirmation: false,
            },
          };
      }

      return {
        outcome: "ok",
        response: {
          message: text || "Aquí están los datos solicitados.",
          suggestion: {
            action: call.name as AgentSuggestion["action"],
            data: data as AgentSuggestion["data"],
          } as AgentSuggestion,
          requiresConfirmation: false,
        },
      };
    } catch (error) {
      logStructured({
        event: "agent_read_action_error",
        level: "error",
        orgId,
        role,
        action: call.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return {
        outcome: "error",
        response: {
          message: `Error al consultar los datos: ${error instanceof Error ? error.message : "Error desconocido"}`,
          suggestion: null,
          requiresConfirmation: false,
        },
      };
    }
  }
}
