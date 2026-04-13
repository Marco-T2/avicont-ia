import {
  SchemaType,
  type FunctionDeclaration,
} from "@google/generative-ai";
import type { Role } from "@/features/shared/permissions";

// ── Socio tools (farming operations) ──

const createExpenseTool: FunctionDeclaration = {
  name: "createExpense",
  description:
    "Sugerir la creación de un gasto para un lote de pollos. Extraer monto, categoría, lote y fecha del mensaje del usuario.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: {
        type: SchemaType.NUMBER,
        description: "Monto del gasto en bolivianos",
      },
      category: {
        type: SchemaType.STRING,
        description:
          "Categoría del gasto. Valores posibles: ALIMENTO, CHALA, AGUA, GARRAFAS, MANTENIMIENTO, GALPONERO, MEDICAMENTOS, VETERINARIO, OTROS",
      },
      description: {
        type: SchemaType.STRING,
        description: "Descripción opcional del gasto",
      },
      lotId: {
        type: SchemaType.STRING,
        description: "ID del lote al que corresponde el gasto",
      },
      date: {
        type: SchemaType.STRING,
        description: "Fecha del gasto en formato YYYY-MM-DD",
      },
    },
    required: ["amount", "category", "lotId", "date"],
  },
};

const logMortalityTool: FunctionDeclaration = {
  name: "logMortality",
  description:
    "Sugerir el registro de mortalidad de pollos en un lote. Extraer cantidad, causa, lote y fecha.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      count: {
        type: SchemaType.INTEGER,
        description: "Cantidad de pollos muertos",
      },
      cause: {
        type: SchemaType.STRING,
        description: "Causa de la mortalidad (opcional)",
      },
      lotId: {
        type: SchemaType.STRING,
        description: "ID del lote",
      },
      date: {
        type: SchemaType.STRING,
        description: "Fecha del evento en formato YYYY-MM-DD",
      },
    },
    required: ["count", "lotId", "date"],
  },
};

const getLotSummaryTool: FunctionDeclaration = {
  name: "getLotSummary",
  description:
    "Obtener el resumen de un lote: gastos totales, mortalidad, pollos vivos y costo por pollo.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      lotId: {
        type: SchemaType.STRING,
        description: "ID del lote",
      },
    },
    required: ["lotId"],
  },
};

const listFarmsTool: FunctionDeclaration = {
  name: "listFarms",
  description: "Listar todas las granjas del usuario en la organización.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

const listLotsTool: FunctionDeclaration = {
  name: "listLots",
  description: "Listar los lotes de una granja específica.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      farmId: {
        type: SchemaType.STRING,
        description: "ID de la granja",
      },
    },
    required: ["farmId"],
  },
};

// ── Contador tools (accounting operations) ──

const getTrialBalanceTool: FunctionDeclaration = {
  name: "getTrialBalance",
  description:
    "Obtener el balance de comprobación (balance de sumas y saldos) de la organización.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description:
          "Fecha de corte en formato YYYY-MM-DD (opcional, por defecto fecha actual)",
      },
    },
  },
};

const getAccountLedgerTool: FunctionDeclaration = {
  name: "getAccountLedger",
  description:
    "Obtener el libro mayor (movimientos) de una cuenta contable específica.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      accountId: {
        type: SchemaType.STRING,
        description: "ID de la cuenta contable",
      },
      dateFrom: {
        type: SchemaType.STRING,
        description: "Fecha inicial del rango en formato YYYY-MM-DD (opcional)",
      },
      dateTo: {
        type: SchemaType.STRING,
        description: "Fecha final del rango en formato YYYY-MM-DD (opcional)",
      },
    },
    required: ["accountId"],
  },
};

const listAccountsTool: FunctionDeclaration = {
  name: "listAccounts",
  description:
    "Listar el plan de cuentas (todas las cuentas contables) de la organización.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

// ── Shared tools (RAG search) ──

const searchDocumentsTool: FunctionDeclaration = {
  name: "searchDocuments",
  description:
    "Buscar información en los documentos de la organización usando búsqueda semántica. Usar cuando el usuario pregunte sobre políticas, contratos, normas o cualquier documento subido.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description:
          "Consulta de búsqueda en lenguaje natural para encontrar documentos relevantes",
      },
    },
    required: ["query"],
  },
};

// ── Tool sets by role ──

const socioTools: FunctionDeclaration[] = [
  createExpenseTool,
  logMortalityTool,
  getLotSummaryTool,
  listFarmsTool,
  listLotsTool,
  searchDocumentsTool,
];

const contadorTools: FunctionDeclaration[] = [
  searchDocumentsTool,
];

const adminTools: FunctionDeclaration[] = [
  ...socioTools,
  ...contadorTools.filter((t) => !socioTools.some((s) => s.name === t.name)),
];

/**
 * Obtiene las definiciones de herramientas disponibles para un rol dado.
 */
export function getToolsForRole(role: Role): FunctionDeclaration[] {
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
