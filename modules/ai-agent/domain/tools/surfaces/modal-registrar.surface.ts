import {
  createExpenseTool,
  getLotSummaryTool,
  listFarmsTool,
  listLotsTool,
  logMortalityTool,
  searchDocumentsTool,
} from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * "Registrar con IA" modal surface — write + supporting reads for
 * farm/lot operations. Per spec REQ-1 SCN-1.2.
 */
export const MODAL_REGISTRAR_SURFACE: SurfaceBundle = {
  name: "modal-registrar",
  tools: [
    createExpenseTool,
    logMortalityTool,
    getLotSummaryTool,
    listFarmsTool,
    listLotsTool,
    searchDocumentsTool,
  ],
} as const;
