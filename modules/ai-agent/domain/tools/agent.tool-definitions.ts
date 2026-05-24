import { z } from "zod";
import { defineTool, type Tool } from "../ports/llm-provider.port.ts";
import { journalEntryAiInputSchema } from "../validation/agent.validation.ts";

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
  resource: "farms",
  action: "write",
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
  resource: "farms",
  action: "write",
});

export const getLotSummaryTool = defineTool({
  name: "getLotSummary",
  description:
    "Obtener el resumen de un lote: gastos totales, mortalidad, pollos vivos y costo por pollo.",
  inputSchema: z.object({
    lotId: z.string().describe("ID del lote"),
  }),
  resource: "farms",
  action: "read",
});

export const listLotsTool = defineTool({
  name: "listLots",
  description:
    "Listar los lotes de la organización. Opcionalmente filtrar por nombre de granja (texto libre).",
  inputSchema: z.object({
    farmName: z
      .string()
      .optional()
      .describe("Nombre de granja (texto libre) para filtrar — opcional"),
  }),
  resource: "farms",
  action: "read",
});

// ── Shared tools (RAG search) ──

export const searchDocumentsTool = defineTool({
  name: "searchDocuments",
  description:
    "Buscar información en los documentos de la organización usando búsqueda semántica. Usar cuando el usuario pregunte sobre políticas, contratos, normas o cualquier documento subido. Pasá `tags` (slugs) para acotar a documentos etiquetados con TODAS esas tags (AND).",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Consulta de búsqueda en lenguaje natural para encontrar documentos relevantes",
      ),
    // REQ-42 — optional tag slugs. AND-semantics applied downstream: results
    // are restricted to documents tagged with ALL provided slugs (resolved to
    // tag IDs in LegacyRagAdapter via TagsRepositoryPort.findBySlugs).
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Lista opcional de slugs de tags. Si se pasa, sólo se retornan chunks de documentos etiquetados con TODAS las tags (AND).",
      ),
  }),
  resource: "documents",
  action: "read",
});

// ── Tool para modo journal-entry-ai (captura asistida de asientos) ──

export const parseAccountingOperationToSuggestionTool = defineTool({
  name: "parseAccountingOperationToSuggestion",
  description:
    "Construye una sugerencia estructurada de asiento contable en borrador a partir " +
    "de una plantilla y parámetros ya resueltos. Llamá esta tool SOLO cuando ya hayas " +
    "resuelto los IDs de cuentas con findAccountsByPurpose y, si la operación lo requiere, " +
    "el ID del contacto con findContact. NO inventes IDs — la validación de existencia " +
    "rechaza cualquier ID que no esté en la base de datos. Esta tool NO persiste el " +
    "asiento; la creación real se confirma desde el modal de la UI.",
  inputSchema: journalEntryAiInputSchema,
  resource: "journal",
  action: "write",
});

// Tools del modo "captura asistida de asientos contables"
export const journalEntryAiTools: Tool[] = [parseAccountingOperationToSuggestionTool];

/**
 * Registro central de tools por nombre. El executor usa este registry para
 * resolver el inputSchema correspondiente a una tool call y validarla
 * (safeParse) antes de ejecutar el handler.
 */
export const TOOL_REGISTRY: Record<string, Tool> = {
  [createExpenseTool.name]: createExpenseTool,
  [logMortalityTool.name]: logMortalityTool,
  [getLotSummaryTool.name]: getLotSummaryTool,
  [listLotsTool.name]: listLotsTool,
  [searchDocumentsTool.name]: searchDocumentsTool,
  [parseAccountingOperationToSuggestionTool.name]: parseAccountingOperationToSuggestionTool,
};

/**
 * Verifica si una acción es de escritura (modifica datos) o de solo lectura.
 */
export function isWriteAction(actionName: string): boolean {
  return actionName === "createExpense" || actionName === "logMortality";
}
