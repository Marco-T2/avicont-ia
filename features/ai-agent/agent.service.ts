import { queryWithTools } from "./gemini.client";
import { getToolsForRole, isWriteAction } from "./agent.tools";
import { buildAgentContext } from "./agent.context";
import type {
  AgentResponse,
  AgentRole,
  AgentSuggestion,
} from "./agent.types";

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
  ): Promise<AgentResponse> {
    const agentRole = this.normalizeRole(role);
    const tools = getToolsForRole(agentRole);

    if (tools.length === 0) {
      return {
        message: "No tienes herramientas disponibles para tu rol actual.",
        suggestion: null,
        requiresConfirmation: false,
      };
    }

    const context = await buildAgentContext(orgId, userId, agentRole);
    const systemPrompt = this.buildSystemPrompt(agentRole, context);

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
          return this.buildWriteSuggestion(actionName, args, result.text);
        }

        // Read actions: execute immediately and return results
        return await this.executeReadAction(
          orgId,
          actionName,
          args,
          result.text,
        );
      }

      // No function call — just a text response
      return {
        message: result.text || "No pude procesar tu solicitud.",
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

  private normalizeRole(role: string): AgentRole {
    const lower = role.toLowerCase();
    if (lower === "socio" || lower === "member") return "socio";
    if (lower === "contador" || lower === "accountant") return "contador";
    if (lower === "admin" || lower === "owner") return "admin";
    return "socio";
  }

  private buildSystemPrompt(role: AgentRole, context: string): string {
    const roleDescriptions: Record<AgentRole, string> = {
      socio:
        "Eres un asistente para un socio avicultor. Ayudas a registrar gastos, mortalidad y consultar información sobre sus lotes y granjas.",
      contador:
        "Eres un asistente para un contador. Ayudas a consultar balances, libros mayores y el plan de cuentas.",
      admin:
        "Eres un asistente administrativo con acceso completo. Puedes ayudar tanto con operaciones avícolas como contables.",
    };

    return [
      "Eres un asistente de IA para Avicont, un sistema de contabilidad avícola.",
      roleDescriptions[role],
      "",
      "REGLAS IMPORTANTES:",
      "- Responde siempre en ESPAÑOL.",
      "- Usa las herramientas disponibles cuando el usuario pida una acción.",
      "- Para crear gastos o registrar mortalidad, usa la herramienta correspondiente para extraer los datos estructurados.",
      "- Si no tienes suficiente información (por ejemplo, falta el lote), pregunta al usuario.",
      "- Usa los IDs reales de los datos del contexto cuando sea posible.",
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
            args.date ? new Date(args.date as string) : undefined,
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
