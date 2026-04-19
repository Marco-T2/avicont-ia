import "server-only";
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
  cobrador: "socio",
  member: "socio",
};

// ── Ejecutores de herramientas de solo lectura ──

import { FarmsService } from "@/features/farms";
import { LotsService } from "@/features/lots";
import { PricingService } from "@/features/pricing/server";

const farmsService = new FarmsService();
const lotsService = new LotsService();
const pricingService = new PricingService();

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

    // Inyectar historial de conversación en el contexto
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

    // Guardar mensaje del usuario en memoria
    if (sessionId) {
      memoryRepo.saveMessage(sessionId, orgId, userId, "user", prompt).catch(
        (err) => console.error("Failed to save user message:", err),
      );
    }

    try {
      const result = await queryWithTools(systemPrompt, prompt, tools);

      const functionCalls = result.functionCalls;

      // Si Gemini eligió llamar una función
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const actionName = call.name;
        const args = call.args as Record<string, unknown>;

        // Acciones de escritura: retornar sugerencia para confirmación del usuario
        if (isWriteAction(actionName)) {
          const response = this.buildWriteSuggestion(actionName, args, result.text);
          if (sessionId) {
            memoryRepo.saveMessage(sessionId, orgId, userId, "assistant", response.message).catch(
              (err) => console.error("Failed to save assistant message:", err),
            );
          }
          return response;
        }

        // Acciones de lectura: ejecutar inmediatamente y retornar resultados
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

      // Sin llamada a función — solo respuesta de texto
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
