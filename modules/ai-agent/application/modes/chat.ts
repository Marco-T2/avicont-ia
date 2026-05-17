import type {
  ToolCall,
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
import type { ConversationTurn } from "../../domain/types/conversation";
import {
  MAX_CHAT_TURNS,
  MAX_TURN_FALLBACK_MESSAGE,
} from "./chat.constants.ts";

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
  // Aggregated across all LLM calls in the multi-turn loop (REQ-24). Gemini
  // reports per-call `usageMetadata`, NOT cumulative — summing here is the
  // correct behavior for the `agent_invocation` event.
  const aggregatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  let hasUsage = false;
  const allToolCalls: ToolCall[] = [];
  let turnCount = 0;
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

    // ── Multi-turn LLM loop (REQ-19) ─────────────────────────────────────
    // Strategy:
    //   1. Seed conversationHistory with the user turn.
    //   2. Call LLM. If response is text-only → final answer, exit loop.
    //   3. If response carries tool_calls:
    //        - write tool (single, by surface gate) → handleWriteCall + exit.
    //        - searchDocuments single-call at turn 1 → RAG bypass + exit
    //          (REQ-25). Multi-turn does NOT apply to RAG (design D-25).
    //        - read tools → execute ALL (S-03 fix per SCN-19.2), append
    //          one ModelTurn + N ToolResultTurn entries, loop.
    //   4. If the loop reaches MAX_CHAT_TURNS still with tool_calls → emit
    //      `chat_max_turns_reached` warn + fallback message (REQ-23).
    const conversation: ConversationTurn[] = [
      { kind: "user", content: prompt },
    ];
    let finalResponse: AgentResponse | null = null;

    for (turnCount = 1; turnCount <= MAX_CHAT_TURNS; turnCount++) {
      const result = await llmProvider.query({
        systemPrompt,
        userMessage: prompt,
        tools,
        conversationHistory: conversation,
      });

      if (result.usage) {
        aggregatedUsage.inputTokens += result.usage.inputTokens;
        aggregatedUsage.outputTokens += result.usage.outputTokens;
        aggregatedUsage.totalTokens += result.usage.totalTokens;
        hasUsage = true;
      }

      const turnToolCalls = result.toolCalls;

      // Text-only response → final answer.
      if (turnToolCalls.length === 0) {
        const message = result.text || "No pude procesar tu solicitud.";
        finalResponse = {
          message,
          suggestion: null,
          requiresConfirmation: false,
        };
        break;
      }

      // Write tool short-circuit. Write surfaces never multi-call (gated by
      // surface resolver); take the first one and exit the loop.
      const writeCall = turnToolCalls.find((c) => isWriteAction(c.name));
      if (writeCall) {
        allToolCalls.push(writeCall);
        const exec = await handleWriteCall(
          TOOL_REGISTRY,
          writeCall,
          result.text,
          logStructured,
        );
        outcome = exec.outcome;
        finalResponse = exec.response;
        break;
      }

      // REQ-25 searchDocuments bypass — fires ONLY at turn 1 AND when it is
      // the sole tool_call (mixed-call case falls through to normal loop).
      if (
        turnCount === 1 &&
        turnToolCalls.length === 1 &&
        turnToolCalls[0].name === "searchDocuments"
      ) {
        const call = turnToolCalls[0];
        allToolCalls.push(call);
        const validation = validateToolInput(TOOL_REGISTRY, call, logStructured);
        if (!validation.ok) {
          outcome = "validation_failed";
          finalResponse = validation.response;
          break;
        }
        const ragText = await buildRagContext(
          rag,
          orgId,
          (validation.input.query as string) ?? prompt,
          role,
        );
        finalResponse = {
          message:
            result.text || ragText || "No se encontraron documentos relevantes.",
          suggestion: null,
          requiresConfirmation: false,
        };
        break;
      }

      // Append the model turn (text may be empty for pure-call responses).
      conversation.push({
        kind: "model",
        content: result.text,
        toolCalls: turnToolCalls,
      });
      allToolCalls.push(...turnToolCalls);

      // Execute ALL read tool calls sequentially (S-03 fix). Each call's
      // result (or error envelope) becomes a ToolResultTurn so the next
      // LLM call can see the data.
      for (const call of turnToolCalls) {
        const exec = await executeReadTool(
          { farmInquiry, lotInquiry, pricingService, accountingQuery },
          TOOL_REGISTRY,
          orgId,
          call,
          logStructured,
        );
        if (!exec.ok) {
          // Track validation failures in outcome but keep looping so the LLM
          // can react. Tool-execution errors are wrapped as `{ error: msg }`
          // (REQ-27 + adapter object-wrap contract).
          if (exec.outcome) outcome = exec.outcome;
        }
        conversation.push({
          kind: "tool_result",
          toolCallId: call.id,
          name: call.name,
          result: exec.ok ? exec.data : { error: exec.error },
        });
      }
    }

    // Cap exhausted with no final text turn.
    if (!finalResponse) {
      logStructured({
        event: "chat_max_turns_reached",
        level: "warn",
        turnCount: MAX_CHAT_TURNS,
        toolNames: allToolCalls.map((c) => c.name),
      });
      finalResponse = {
        message: MAX_TURN_FALLBACK_MESSAGE,
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    if (sessionId) {
      await chatMemory.append(orgId, userId, sessionId, {
        role: "model",
        content: finalResponse.message,
      });
    }
    return finalResponse;
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
      inputTokens: hasUsage ? aggregatedUsage.inputTokens : null,
      outputTokens: hasUsage ? aggregatedUsage.outputTokens : null,
      totalTokens: hasUsage ? aggregatedUsage.totalTokens : null,
      turnCount,
      toolCallsCount: allToolCalls.length,
      toolNames: allToolCalls.map((c) => c.name),
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

  // Tool-result formatting instruction (REQ-29, supersedes REQ-26 literal per
  // [[named_rule_immutability]] — derivative rule with same intent but
  // prescribed compact format). EXACT Spanish text locked per
  // [[textual_rule_verification]] + [[engram_textual_rule_verification]] —
  // any change requires a new SDD with a RED test mirroring the new text.
  // Placed AFTER moduleHintLines and BEFORE the DATOS block.
  const formatLines = [
    "",
    "Cuando muestres listas de resultados, usá formato compacto: una línea por entrada con campos esenciales (fecha, identificador, monto). Sin descripciones extensas, sin status, sin markdown. Ejemplo para asientos: '16/05/2026 CI-2 Bs2000' (CI=Comprobante Ingreso, N sin ceros).",
  ];

  return [
    "Asistente Avicont.",
    roleDescriptions[label],
    `Hoy: ${todayISO}`,
    ...contextHintsLines,
    ...moduleHintLines,
    ...formatLines,
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
  accountingQuery: AccountingQueryPort;
}

type ReadToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; outcome?: InvocationOutcome };

/**
 * Execute a single read tool and return its raw data (or an error envelope).
 *
 * Replaces the pre-REQ-19 `handleReadCall` which packaged the result into an
 * `AgentResponse` with the "Aquí están los datos solicitados." placeholder.
 * The multi-turn loop in `executeChatMode` now feeds the raw data back into
 * the LLM so the model writes a real natural-language answer (REQ-19).
 *
 * Note: `searchDocuments` is NOT routed here — its RAG bypass lives directly
 * in the loop (REQ-25). Routing it through this helper would either return
 * the RAG text as `data` (wrong for the bypass) or duplicate the bypass.
 */
async function executeReadTool(
  deps: ReadCallDeps,
  registry: ToolRegistry,
  orgId: string,
  call: ToolCall,
  logStructured: LogFn,
): Promise<ReadToolResult> {
  const { farmInquiry, lotInquiry, pricingService, accountingQuery } = deps;
  const validation = validateToolInput(registry, call, logStructured);
  if (!validation.ok) {
    return {
      ok: false,
      error: `invalid arguments for ${call.name}`,
      outcome: "validation_failed",
    };
  }
  const args = validation.input;

  try {
    switch (call.name) {
      case "listFarms":
        return { ok: true, data: await farmInquiry.list(orgId) };
      case "listLots":
        return {
          ok: true,
          data: await lotInquiry.list(orgId, {
            farmId: args.farmId as string,
          }),
        };
      case "getLotSummary":
        return {
          ok: true,
          data: await pricingService.calculateLotCost(
            orgId,
            args.lotId as string,
          ),
        };
      case "listRecentJournalEntries":
        return {
          ok: true,
          data: await accountingQuery.listRecentJournalEntries(
            orgId,
            (args.limit as number | undefined) ?? 10,
          ),
        };
      case "getAccountMovements":
        return {
          ok: true,
          data: await accountingQuery.getAccountMovements(
            orgId,
            args.accountId as string,
            args.dateFrom as string | undefined,
            args.dateTo as string | undefined,
          ),
        };
      case "getAccountBalance":
        return {
          ok: true,
          data: await accountingQuery.getAccountBalance(
            orgId,
            args.accountId as string,
          ),
        };
      case "listSales":
        return {
          ok: true,
          data: await accountingQuery.listSales(
            orgId,
            args.dateFrom as string | undefined,
            args.dateTo as string | undefined,
            (args.limit as number | undefined) ?? 20,
          ),
        };
      case "listPurchases":
        return {
          ok: true,
          data: await accountingQuery.listPurchases(
            orgId,
            args.dateFrom as string | undefined,
            args.dateTo as string | undefined,
            (args.limit as number | undefined) ?? 20,
          ),
        };
      case "listPayments":
        return {
          ok: true,
          data: await accountingQuery.listPayments(
            orgId,
            args.dateFrom as string | undefined,
            args.dateTo as string | undefined,
            (args.limit as number | undefined) ?? 20,
          ),
        };
      default:
        return {
          ok: false,
          error: `unknown tool: ${call.name}`,
          outcome: "unexpected_tool",
        };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured({
      event: "agent_read_action_error",
      level: "error",
      orgId,
      action: call.name,
      errorMessage: msg,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: msg };
  }
}
