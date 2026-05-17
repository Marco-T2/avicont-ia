import {
  getAccountBalanceTool,
  getAccountMovementsTool,
  listPurchasesTool,
  listRecentJournalEntriesTool,
  listSalesTool,
  searchDocumentsTool,
} from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * Read-only Q&A surface (sidebar chat). RAG search + F2 read-side accounting
 * Q&A tools (REQ-10..15). All `action: "read"`; RBAC handled by
 * `getToolsForSurface` cross-filtering against `PERMISSIONS_READ` per
 * resource. Atomic with `TOOL_REGISTRY` per the surface-tool-coverage
 * sentinel (REQ-17).
 */
export const SIDEBAR_QA_SURFACE: SurfaceBundle = {
  name: "sidebar-qa",
  tools: [
    searchDocumentsTool,
    listRecentJournalEntriesTool,
    getAccountMovementsTool,
    getAccountBalanceTool,
    listSalesTool,
    listPurchasesTool,
  ],
} as const;
