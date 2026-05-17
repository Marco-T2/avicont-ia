import {
  getLotSummaryTool,
  listFarmsTool,
  listLotsTool,
  searchDocumentsTool,
} from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * Conversational sidebar Q&A surface. RAG search + read-only granja tools.
 *
 * Previously included 8 F2 accounting-query tools (listRecentJournalEntries,
 * getAccountMovements, getAccountBalance, findAccountsByName, listAccounts,
 * listSales, listPurchases, listPayments). Removed por decisión de Marco
 * (cleanup #2026-05-17): duplicaban las páginas dedicadas (`/accounting/...`)
 * y la UI exacta siempre es más confiable que la respuesta del LLM. Las tools
 * restantes tienen IDs explícitos (granja) o son semánticas (searchDocuments —
 * RAG), criterio "difícilmente falla". Rollback path: git revert el commit
 * de cleanup si se decide restaurar.
 *
 * All `action: "read"`; RBAC handled by `getToolsForSurface` cross-filtering
 * against `PERMISSIONS_READ` per resource. Atomic with `TOOL_REGISTRY` per
 * the surface-tool-coverage sentinel.
 */
export const SIDEBAR_QA_SURFACE: SurfaceBundle = {
  name: "sidebar-qa",
  tools: [
    searchDocumentsTool,
    getLotSummaryTool,
    listFarmsTool,
    listLotsTool,
  ],
} as const;
