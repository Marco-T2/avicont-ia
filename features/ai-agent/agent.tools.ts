import { z } from "zod";
import { defineTool, type Tool } from "./llm";
import type { Role } from "@/features/permissions";
import { parseAccountingOperationToSuggestionTool } from "./tools";

// ── Socio tools (farming operations) ──

export const createExpenseTool = defineTool({
  name: "createExpense",
  description:
    "Sugerir la creación de un gasto para un lote de pollos. Extraer monto, categoría, lote y fecha del mensaje del usuario.",
  inputSchema: z.object({
    amount: z.number().describe("Monto del gasto en bolivianos"),
    category: z
      .enum([
        "ALIMENTO",
        "CHALA",
        "AGUA",
        "GARRAFAS",
        "MANTENIMIENTO",
        "GALPONERO",
        "MEDICAMENTOS",
        "VETERINARIO",
        "OTROS",
      ])
      .describe("Categoría del gasto"),
    description: z.string().optional().describe("Descripción opcional del gasto"),
    lotId: z.string().describe("ID del lote al que corresponde el gasto"),
    date: z.string().describe("Fecha del gasto en formato YYYY-MM-DD"),
  }),
});

export const logMortalityTool = defineTool({
  name: "logMortality",
  description:
    "Sugerir el registro de mortalidad de pollos en un lote. Extraer cantidad, causa, lote y fecha.",
  inputSchema: z.object({
    count: z.number().int().describe("Cantidad de pollos muertos"),
    cause: z.string().optional().describe("Causa de la mortalidad (opcional)"),
    lotId: z.string().describe("ID del lote"),
    date: z.string().describe("Fecha del evento en formato YYYY-MM-DD"),
  }),
});

export const getLotSummaryTool = defineTool({
  name: "getLotSummary",
  description:
    "Obtener el resumen de un lote: gastos totales, mortalidad, pollos vivos y costo por pollo.",
  inputSchema: z.object({
    lotId: z.string().describe("ID del lote"),
  }),
});

export const listFarmsTool = defineTool({
  name: "listFarms",
  description: "Listar todas las granjas del usuario en la organización.",
  inputSchema: z.object({}),
});

export const listLotsTool = defineTool({
  name: "listLots",
  description: "Listar los lotes de una granja específica.",
  inputSchema: z.object({
    farmId: z.string().describe("ID de la granja"),
  }),
});

// ── Shared tools (RAG search) ──

export const searchDocumentsTool = defineTool({
  name: "searchDocuments",
  description:
    "Buscar información en los documentos de la organización usando búsqueda semántica. Usar cuando el usuario pregunte sobre políticas, contratos, normas o cualquier documento subido.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Consulta de búsqueda en lenguaje natural para encontrar documentos relevantes",
      ),
  }),
});

// ── Tool sets by role ──

const socioTools: Tool[] = [
  createExpenseTool,
  logMortalityTool,
  getLotSummaryTool,
  listFarmsTool,
  listLotsTool,
  searchDocumentsTool,
];

const contadorTools: Tool[] = [searchDocumentsTool];

const adminTools: Tool[] = [
  ...socioTools,
  ...contadorTools.filter((t) => !socioTools.some((s) => s.name === t.name)),
];

// Tools del modo "captura asistida de asientos contables" (botón "+ Crear Asiento
// con IA" en /accounting/journal). Single-tool por diseño: el catálogo de cuentas
// y proveedores viaja precargado en el system prompt vía contextHints. Las
// funciones executor de findAccountsByPurpose y findContact viven en
// features/ai-agent/tools/ pero se invocan desde endpoints HTTP genéricos
// (/api/.../accounts, /api/.../contacts), no como tools del LLM.
export const journalEntryAiTools: Tool[] = [parseAccountingOperationToSuggestionTool];

/**
 * Registro central de tools por nombre. El executor usa este registry para
 * resolver el inputSchema correspondiente a una tool call y validarla
 * (safeParse) antes de ejecutar el handler. Single source of truth.
 */
export const TOOL_REGISTRY: Record<string, Tool> = {
  [createExpenseTool.name]: createExpenseTool,
  [logMortalityTool.name]: logMortalityTool,
  [getLotSummaryTool.name]: getLotSummaryTool,
  [listFarmsTool.name]: listFarmsTool,
  [listLotsTool.name]: listLotsTool,
  [searchDocumentsTool.name]: searchDocumentsTool,
  [parseAccountingOperationToSuggestionTool.name]: parseAccountingOperationToSuggestionTool,
};

/**
 * Obtiene las definiciones de herramientas disponibles para un rol dado.
 */
export function getToolsForRole(role: Role): Tool[] {
  switch (role) {
    case "member":
      return socioTools;
    case "contador":
      return contadorTools;
    case "admin":
    case "owner":
      return adminTools;
    default:
      return [];
  }
}

/**
 * Verifica si una acción es de escritura (modifica datos) o de solo lectura.
 * Las acciones de escritura requieren confirmación del usuario antes de ejecutarse.
 */
export function isWriteAction(actionName: string): boolean {
  return actionName === "createExpense" || actionName === "logMortality";
}
