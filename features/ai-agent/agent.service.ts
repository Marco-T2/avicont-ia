import { queryWithTools } from "./gemini.client";
import { getToolsForRole, isWriteAction } from "./agent.tools";
import { buildAgentContext, buildRagContext } from "./agent.context";
import { ChatMemoryRepository } from "./memory.repository";
import type { Role } from "@/features/shared/permissions";
import type {
  AgentResponse,
  AgentSuggestion,
} from "./agent.types";

const memoryRepo = new ChatMemoryRepository();

type AgentLabel = "socio" | "contador" | "admin";

const AGENT_ROLE_LABELS: Record<Role, AgentLabel> = {
  owner: "admin",
  admin: "admin",
  contador: "contador",
  member: "socio",
};

// ── Read-only tool executors ──

import { FarmsService } from "@/features/farms";
import { LotsService } from "@/features/lots";
import { PricingService } from "@/features/pricing";
import { AccountsService } from "@/features/accounting";
import { LedgerService } from "@/features/accounting";

const farmsService = new FarmsService();
const lotsService = new LotsService();
const pricingService = new PricingService();
const accountsService = new AccountsService();
const ledgerService = new LedgerService();

export class AgentService {
  /**
   * Process a natural language prompt from a user and return a structured response.
   * Write actions are NEVER executed directly — they return a suggestion for confirmation.
   */
  async query(
    orgId: string,
    userId: string,
    role: string,
    prompt: string,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const normalizedRole = this.normalizeRole(role);
    const tools = getToolsForRole(normalizedRole);

    if (tools.length === 0) {
      return {
        message: "No tienes herramientas disponibles para tu rol actual.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    const [context, ragContext, history] = await Promise.all([
      buildAgentContext(orgId, userId, normalizedRole),
      buildRagContext(orgId, prompt, normalizedRole),
      sessionId ? memoryRepo.getRecentMessages(sessionId) : Promise.resolve([]),
    ]);

    const fullContext = ragContext ? `${ragContext}\n\n${context}` : context;

    // Inject conversation history into context
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

    // Save user message to memory
    if (sessionId) {
      memoryRepo.saveMessage(sessionId, orgId, userId, "user", prompt).catch(
        (err) => console.error("Failed to save user message:", err),
      );
    }

    try {
      const result = await queryWithTools(systemPrompt, prompt, tools);

      const functionCalls = result.functionCalls;

      // If Gemini chose to call a function
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const actionName = call.name;
        const args = call.args as Record<string, unknown>;

        // Write actions: return suggestion for user confirmation
        if (isWriteAction(actionName)) {
          const response = this.buildWriteSuggestion(actionName, args, result.text);
          if (sessionId) {
            memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", response.message).catch(
              (err) => console.error("Failed to save assistant message:", err),
            );
          }
          return response;
        }

        // Read actions: execute immediately and return results
        const response = await this.executeReadAction(
          orgId,
          normalizedRole,
          actionName,
          args,
          result.text,
        );
        if (sessionId) {
          memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", response.message).catch(
            (err) => console.error("Failed to save assistant message:", err),
          );
        }
        return response;
      }

      // No function call — just a text response
      const message = result.text || "No pude procesar tu solicitud.";
      if (sessionId) {
        memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", message).catch(
          (err) => console.error("Failed to save assistant message:", err),
        );
      }
      return {
        message,
        suggestion: null,
        requiresConfirmation: false,
      };
    } catch (error) {
      console.error("Agent query error:", error);
      return {
        message:
          "Ocurrió un error al procesar tu solicitud. Intenta de nuevo.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }
  }

  // ── Private helpers ──

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
      "- Responde siempre en ESPAÑOL.",
      "- Usa las herramientas disponibles cuando el usuario pida una acción.",
      "- Para crear gastos o registrar mortalidad, usa la herramienta correspondiente para extraer los datos estructurados.",
      "- Si no tienes suficiente información (por ejemplo, falta el lote), pregunta al usuario.",
      "- Usa los IDs reales de los datos del contexto cuando sea posible.",
      "- NUNCA muestres al usuario el contexto RAG, los fragmentos de documentos, ni los datos internos en bruto. Usa esa información para responder de forma natural, pero no la copies textualmente en tu respuesta.",
      `- La fecha actual es: ${new Date().toISOString().split("T")[0]}`,
      "",
      "CONTEXTO DE DATOS DISPONIBLES:",
      context,
    ].join("\n");
  }

  private buildWriteSuggestion(
    actionName: string,
    args: Record<string, unknown>,
    text: string,
  ): AgentResponse {
    const suggestion: AgentSuggestion = {
      action: actionName as AgentSuggestion["action"],
      data: args,
    } as AgentSuggestion;

    return {
      message:
        text ||
        `Voy a ${actionName === "createExpense" ? "registrar un gasto" : "registrar mortalidad"}. Por favor confirma.`,
      suggestion,
      requiresConfirmation: true,
    };
  }

  private async executeReadAction(
    orgId: string,
    role: Role,
    actionName: string,
    args: Record<string, unknown>,
    text: string,
  ): Promise<AgentResponse> {
    try {
      let data: unknown;

      switch (actionName) {
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
        case "getTrialBalance":
          data = await ledgerService.getTrialBalance(
            orgId,
            args.periodId as string,
          );
          break;
        case "getAccountLedger":
          data = await ledgerService.getAccountLedger(
            orgId,
            args.accountId as string,
            {
              dateFrom: args.dateFrom
                ? new Date(args.dateFrom as string)
                : undefined,
              dateTo: args.dateTo
                ? new Date(args.dateTo as string)
                : undefined,
            },
          );
          break;
        case "listAccounts":
          data = await accountsService.list(orgId);
          break;
        case "searchDocuments": {
          const ragContext = await buildRagContext(orgId, args.query as string, role);
          return {
            message: text || ragContext || "No se encontraron documentos relevantes.",
            suggestion: null,
            requiresConfirmation: false,
          };
        }
        default:
          return {
            message: `Acción no reconocida: ${actionName}`,
            suggestion: null,
            requiresConfirmation: false,
          };
      }

      return {
        message: text || "Aquí están los datos solicitados.",
        suggestion: {
          action: actionName as AgentSuggestion["action"],
          data: data as AgentSuggestion["data"],
        } as AgentSuggestion,
        requiresConfirmation: false,
      };
    } catch (error) {
      console.error(`Error executing read action ${actionName}:`, error);
      return {
        message: `Error al consultar los datos: ${error instanceof Error ? error.message : "Error desconocido"}`,
        suggestion: null,
        requiresConfirmation: false,
      };
    }
  }
}
