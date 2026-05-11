import "server-only";
import { llmClient, type ToolCall, type TokenUsage } from "../llm";
import {
  getToolsForRole,
  isWriteAction,
  TOOL_REGISTRY,
} from "../agent.tools";
import { buildAgentContext, buildRagContext } from "../agent.context";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";
import type { AgentResponse, AgentSuggestion } from "../agent.types";
import type { InvocationOutcome } from "../agent.utils";
import type { ChatMemoryRepository } from "../memory.repository";
import type { FarmInquiryPort } from "@/modules/farm/presentation/server";
import type { LotInquiryPort } from "@/modules/lot/presentation/server";
import type { PricingService } from "@/features/pricing/server";

type AgentLabel = "socio" | "contador" | "admin";

const AGENT_ROLE_LABELS: Record<Role, AgentLabel> = {
  owner: "admin",
  admin: "admin",
  contador: "contador",
  cobrador: "socio",
  member: "socio",
};

export interface ChatModeDeps {
  memoryRepo: ChatMemoryRepository;
  farmInquiry: FarmInquiryPort;
  lotInquiry: LotInquiryPort;
  pricingService: PricingService;
}

export interface ChatModeArgs {
  orgId: string;
  userId: string;
  role: Role;
  prompt: string;
  sessionId?: string;
  contextHints?: unknown;
}

interface ChatContextHintsResolved {
  lotId?: string;
  farmId?: string;
  lotName?: string;
  farmName?: string;
}

// Coerce defensivo paired sister journal-entry-ai.prompt.ts:190 EXACT mirror — frontend
// input degradación graceful si shape no matchea.
function coerceChatContextHints(
  input: unknown,
): ChatContextHintsResolved | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;
  const result: ChatContextHintsResolved = {};
  if (typeof obj.lotId === "string") result.lotId = obj.lotId;
  if (typeof obj.farmId === "string") result.farmId = obj.farmId;
  if (typeof obj.lotName === "string") result.lotName = obj.lotName;
  if (typeof obj.farmName === "string") result.farmName = obj.farmName;
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Procesar un mensaje en lenguaje natural del usuario y retornar una respuesta estructurada.
 * Las acciones de escritura NUNCA se ejecutan directamente — retornan una sugerencia para confirmación.
 */
export async function executeChatMode(
  deps: ChatModeDeps,
  args: ChatModeArgs,
): Promise<AgentResponse> {
  const { memoryRepo, farmInquiry, lotInquiry, pricingService } = deps;
  const { orgId, userId, role, prompt, sessionId, contextHints } = args;
  const resolvedHints = coerceChatContextHints(contextHints);
  const startedAt = performance.now();

  let outcome: InvocationOutcome = "ok";
  let usage: TokenUsage | undefined;
  let toolCalls: readonly ToolCall[] = [];
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    const tools = getToolsForRole(role);

    if (tools.length === 0) {
      outcome = "no_tools_for_role";
      return {
        message: "No tienes herramientas disponibles para tu rol actual.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    const [context, ragContext, history] = await Promise.all([
      buildAgentContext(orgId, userId, role),
      buildRagContext(orgId, prompt, role),
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
    const systemPrompt = buildSystemPrompt(role, contextWithHistory, resolvedHints);

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
        const exec = await handleWriteCall(call, result.text);
        outcome = exec.outcome;
        if (sessionId) {
          await memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", exec.response.message);
        }
        return exec.response;
      }

      const exec = await handleReadCall(
        { farmInquiry, lotInquiry, pricingService },
        orgId,
        role,
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
      mode: "chat",
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
      ...(errorMessage ? { errorMessage } : {}),
      ...(errorStack ? { errorStack } : {}),
    });
  }
}

function buildSystemPrompt(
  role: Role,
  context: string,
  contextHints: ChatContextHintsResolved | undefined,
): string {
  const roleDescriptions: Record<AgentLabel, string> = {
    socio:
      "Eres un asistente para un socio avicultor. Ayudas a registrar gastos, mortalidad y consultar información sobre sus lotes y granjas.",
    contador:
      "Eres un asistente para un contador. Ayudas a consultar balances, libros mayores y el plan de cuentas.",
    admin:
      "Eres un asistente administrativo con acceso completo. Puedes ayudar tanto con operaciones avícolas como contables.",
  };
  const label = AGENT_ROLE_LABELS[role];

  const dateFormatter = new Intl.DateTimeFormat("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  });
  const todayContext = `Hoy es ${dateFormatter.format(new Date())}.`;
  const todayISO = new Date().toISOString().split("T")[0];

  const contextHintsLines: string[] = [];
  if (contextHints?.lotId && contextHints.lotName) {
    const farmPart =
      contextHints.farmId && contextHints.farmName
        ? ` de granja '${contextHints.farmName}' [id: ${contextHints.farmId}]`
        : "";
    contextHintsLines.push(
      "",
      "CONTEXTO ACTUAL DE NAVEGACIÓN:",
      `El usuario está actualmente en Lote '${contextHints.lotName}' [id: ${contextHints.lotId}]${farmPart}.`,
      "Usar estos IDs cuando el usuario refiera al lote/granja actual sin verificar primero.",
    );
  } else if (contextHints?.farmId && contextHints.farmName) {
    contextHintsLines.push(
      "",
      "CONTEXTO ACTUAL DE NAVEGACIÓN:",
      `El usuario está actualmente en Granja '${contextHints.farmName}' [id: ${contextHints.farmId}].`,
      "Usar este ID cuando el usuario refiera a la granja actual sin verificar primero.",
    );
  }

  return [
    "Eres un asistente de IA para Avicont, un sistema de contabilidad avícola.",
    roleDescriptions[label],
    "",
    todayContext,
    "",
    "REGLAS IMPORTANTES:",
    "- Responde siempre en ESPAÑOL.",
    "- Responder MÁXIMO 1-2 oraciones cortas. NO listar enums Spanish completos (ALIMENTO/CHALA/AGUA/etc). NO explicar workflow internal.",
    "- Tu conocimiento contable proviene EXCLUSIVAMENTE de los documentos indexados (RAG). Si no encontrás información relevante en los documentos, decilo claramente. NO inventes datos contables, códigos de cuenta ni información que no esté en los documentos.",
    "- Cuando refieras a una cuenta contable, SIEMPRE incluí el código y el nombre completo. Ejemplo: '1.2.3.1 — Vehículos'. Nunca menciones una cuenta sin su código.",
    "- NUNCA muestres al usuario el contexto RAG, los fragmentos de documentos, ni los datos internos en bruto. Usa esa información para responder de forma natural, pero no la copies textualmente en tu respuesta.",
    "- Si NO se te proporciona un bloque 'Contexto de Documentos (RAG)', significa que no se encontraron documentos relevantes. En ese caso, responde únicamente con los datos estructurados disponibles y, si la pregunta requiere información documental que no tenés, indicalo claramente al usuario en vez de inventar.",
    "",
    "REGLAS TOOL SELECTION:",
    "- Cuando el usuario expresa intent REGISTRAR/CREAR/GUARDAR/COMPRAR (gasto, mortalidad, compra), invocá DIRECTAMENTE write tool (createExpense/logMortality) con la info disponible. NO uses getLotSummary/listLots/listFarms para verificar primero — los IDs vienen pre-resueltos en el contexto.",
    "",
    "REGLAS FECHAS:",
    "- Si el usuario NO menciona fecha explícita NI relativa, asumir HOY automáticamente. NO preguntar fecha.",
    "- Resolver fechas relativas Spanish al formato YYYY-MM-DD usando 'hoy' como referencia:",
    "  - hoy → fecha actual",
    "  - ayer → -1 día",
    "  - antier o anteayer → -2 días",
    "  - el [día semana] → último ocurrencia día (Bolivia: lunes/martes/miércoles/jueves/viernes/sábado/domingo)",
    "  - el [día semana] pasado → último anterior hoy",
    "  - hace N días → -N días",
    `- La fecha actual (HOY) es: ${todayISO}`,
    "- Si el usuario menciona fecha ambigua sin día específico ('la semana pasada', 'hace tiempo', 'el mes pasado'), preguntar clarification corto ('¿qué día exacto?') en lugar de asumir.",
    ...contextHintsLines,
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
function validateToolInput(
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

async function handleWriteCall(
  call: ToolCall,
  text: string,
): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
  const validation = validateToolInput(call);
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

interface ReadCallDeps {
  farmInquiry: FarmInquiryPort;
  lotInquiry: LotInquiryPort;
  pricingService: PricingService;
}

async function handleReadCall(
  deps: ReadCallDeps,
  orgId: string,
  role: Role,
  call: ToolCall,
  text: string,
): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
  const { farmInquiry, lotInquiry, pricingService } = deps;
  const validation = validateToolInput(call);
  if (!validation.ok) {
    return { response: validation.response, outcome: "validation_failed" };
  }
  const args = validation.input;

  try {
    let data: unknown;

    switch (call.name) {
      case "listFarms":
        data = await farmInquiry.list(orgId);
        break;
      case "listLots":
        data = await lotInquiry.list(orgId, {
          farmId: args.farmId as string,
        });
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
