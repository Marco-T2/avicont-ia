import type {
  ToolCall,
  TokenUsage,
  LLMProviderPort,
} from "../../domain/ports/llm-provider.port";
import type { Role } from "@/modules/permissions/domain/permissions";
import type {
  AgentResponse,
  AgentSuggestion,
} from "../../domain/types/agent.types";
import type { InvocationOutcome } from "../../domain/agent-utils";
import type { ChatMemoryPort } from "../../domain/ports/chat-memory.port";
import type { AgentContextReaderPort } from "../../domain/ports/agent-context-reader.port";
import type { RagPort } from "../../domain/ports/rag.port";
import type { FarmInquiryPort } from "@/modules/farm/presentation/server";
import type { LotInquiryPort } from "@/modules/lot/presentation/server";
import type { PricingService } from "../pricing/pricing.service";
import type { Surface } from "../../domain/tools/surfaces/surface.types";
import type { ModuleHintValue } from "../../domain/types/module-hint.types";
import type { AccountingQueryPort } from "../../domain/ports/accounting-query.port";

type AgentLabel = "socio" | "contador" | "admin";

const AGENT_ROLE_LABELS: Record<Role, AgentLabel> = {
  owner: "admin",
  admin: "admin",
  contador: "contador",
  cobrador: "socio",
  member: "socio",
};

export interface ChatModeDeps {
  llmProvider: LLMProviderPort;
  chatMemory: ChatMemoryPort;
  contextReader: AgentContextReaderPort;
  rag: RagPort;
  farmInquiry: FarmInquiryPort;
  lotInquiry: LotInquiryPort;
  pricingService: PricingService;
  accountingQuery: AccountingQueryPort;
}

export interface ChatModeArgs {
  orgId: string;
  userId: string;
  role: Role;
  prompt: string;
  surface: Surface;
  // Optional in TS for incremental adoption. `null` is a real value meaning
  // "no current module" (sidebar on a non-mapped route); `undefined` is the
  // legacy-caller signal (modals never set this). buildSystemPrompt coerces
  // undefined -> null defensively.
  moduleHint?: ModuleHintValue;
  sessionId?: string;
  contextHints?: unknown;
}

interface ChatContextHintsResolved {
  lotId?: string;
  farmId?: string;
  lotName?: string;
  farmName?: string;
}

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
 *
 * REQ-005: LLMProviderPort vía deps — singleton llmClient ELIMINADO.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeChatMode(
  deps: ChatModeDeps,
  args: ChatModeArgs,
): Promise<AgentResponse> {
  const [
    { isWriteAction, TOOL_REGISTRY },
    { getToolsForSurface },
    { buildAgentContext, buildRagContext },
    { logStructured },
  ] = await Promise.all([
    import("../../domain/tools/agent.tool-definitions.ts"),
    import("../../domain/tools/surfaces/index.ts"),
    import("../agent.context.ts"),
    import("../../../../lib/logging/structured.ts"),
  ]);

  const {
    llmProvider,
    chatMemory,
    contextReader,
    rag,
    farmInquiry,
    lotInquiry,
    pricingService,
    accountingQuery,
  } = deps;
  const { orgId, userId, role, prompt, surface, sessionId, contextHints } = args;
  const moduleHint: ModuleHintValue = args.moduleHint ?? null;
  const resolvedHints = coerceChatContextHints(contextHints);
  const startedAt = performance.now();

  let outcome: InvocationOutcome = "ok";
  let usage: TokenUsage | undefined;
  let toolCalls: readonly ToolCall[] = [];
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    const tools = getToolsForSurface({ surface, role });

    if (tools.length === 0) {
      outcome = "no_tools_for_role";
      return {
        message: "No tienes herramientas disponibles para tu rol actual.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    const [context, ragContext, history] = await Promise.all([
      buildAgentContext({ contextReader, rag }, orgId, userId, role),
      buildRagContext(rag, orgId, prompt, role),
      sessionId
        ? chatMemory.findRecent(orgId, userId, sessionId, 10)
        : Promise.resolve([]),
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
    const systemPrompt = buildSystemPrompt(role, contextWithHistory, resolvedHints, moduleHint);

    if (sessionId) {
      await chatMemory.append(orgId, userId, sessionId, {
        role: "user",
        content: prompt,
      });
    }

    const result = await llmProvider.query({
      systemPrompt,
      userMessage: prompt,
      tools,
    });

    usage = result.usage;
    toolCalls = result.toolCalls;

    if (toolCalls.length > 0) {
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
        const exec = await handleWriteCall(TOOL_REGISTRY, call, result.text, logStructured);
        outcome = exec.outcome;
        if (sessionId) {
          await chatMemory.append(orgId, userId, sessionId, {
            role: "model",
            content: exec.response.message,
          });
        }
        return exec.response;
      }

      const exec = await handleReadCall(
        { farmInquiry, lotInquiry, pricingService, rag, accountingQuery },
        TOOL_REGISTRY,
        buildRagContext,
        orgId,
        role,
        call,
        result.text,
        logStructured,
      );
      outcome = exec.outcome;
      if (sessionId) {
        await chatMemory.append(orgId, userId, sessionId, {
          role: "model",
          content: exec.response.message,
        });
      }
      return exec.response;
    }

    const message = result.text || "No pude procesar tu solicitud.";
    if (sessionId) {
      await chatMemory.append(orgId, userId, sessionId, {
        role: "model",
        content: message,
      });
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
      message: "Ocurrió un error al procesar tu solicitud. Intenta de nuevo.",
      suggestion: null,
      requiresConfirmation: false,
    };
  } finally {
    logStructured({
      event: "agent_invocation",
      level: "info",
      mode: "chat",
      surface,
      moduleHint,
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
  moduleHint: ModuleHintValue,
): string {
  const roleDescriptions: Record<AgentLabel, string> = {
    socio:
      "Eres un asistente para un socio avicultor.",
    contador:
      "Eres un asistente para un contador.",
    admin:
      "Eres un asistente administrativo con acceso completo.",
  };
  const label = AGENT_ROLE_LABELS[role];

  const todayISO = new Date().toISOString().split("T")[0];

  const contextHintsLines: string[] = [];
  if (contextHints?.lotId && contextHints.lotName) {
    contextHintsLines.push(
      `Lote actual: ${contextHints.lotName} [id: ${contextHints.lotId}]`,
    );
  } else if (contextHints?.farmId && contextHints.farmName) {
    contextHintsLines.push(
      `Granja actual: ${contextHints.farmName} [id: ${contextHints.farmId}]`,
    );
  }

  // Module-hint paragraph. EXACT Spanish text locked in design D4.2 per
  // [[textual_rule_verification]] — any future change requires a dedicated
  // SDD with a new RED test reflecting the new text.
  const moduleHintLines: string[] = [];
  if (moduleHint !== null) {
    const moduleLabel = moduleHint === "accounting" ? "Contabilidad" : "Granja";
    moduleHintLines.push(
      "",
      `Contexto del usuario: el usuario está actualmente en la sección de ${moduleLabel}. Cuando elijas herramientas, priorizá las que sean relevantes a este módulo. No fuerces el dominio si la pregunta es explícitamente de otra área.`,
    );
  }

  return [
    "Asistente Avicont.",
    roleDescriptions[label],
    `Hoy: ${todayISO}`,
    ...contextHintsLines,
    ...moduleHintLines,
    "",
    "DATOS:",
    context,
  ].join("\n");
}

// ToolRegistry shape matches domain Tool — we only need .inputSchema.safeParse here.
// Use unknown-based loose shape so the static value passed in (Record<string, Tool>)
// satisfies it via structural assignability.
type ToolLike = { name: string; inputSchema: { safeParse(v: unknown): unknown } };
type ToolRegistry = Record<string, ToolLike>;
type LogFn = (entry: Record<string, unknown>) => void;

type ParseResult = {
  success: boolean;
  data?: unknown;
  error?: { issues: Array<{ path: Array<string | number>; message: string }> };
};

function validateToolInput(
  registry: ToolRegistry,
  call: ToolCall,
  logStructured: LogFn,
):
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; response: AgentResponse } {
  const tool = registry[call.name];
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

  const parsed = tool.inputSchema.safeParse(call.input) as ParseResult;
  if (!parsed.success) {
    logStructured({
      event: "tool_input_validation_failed",
      level: "warn",
      tool: call.name,
      issues: parsed.error?.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })) ?? [],
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
  registry: ToolRegistry,
  call: ToolCall,
  text: string,
  logStructured: LogFn,
): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
  const validation = validateToolInput(registry, call, logStructured);
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
  rag: RagPort;
  accountingQuery: AccountingQueryPort;
}

async function handleReadCall(
  deps: ReadCallDeps,
  registry: ToolRegistry,
  buildRagContextFn: (rag: RagPort, orgId: string, query: string, role: Role) => Promise<string>,
  orgId: string,
  role: Role,
  call: ToolCall,
  text: string,
  logStructured: LogFn,
): Promise<{ response: AgentResponse; outcome: InvocationOutcome }> {
  const { farmInquiry, lotInquiry, pricingService, rag, accountingQuery } = deps;
  const validation = validateToolInput(registry, call, logStructured);
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
        const ragContext = await buildRagContextFn(rag, orgId, args.query as string, role);
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
