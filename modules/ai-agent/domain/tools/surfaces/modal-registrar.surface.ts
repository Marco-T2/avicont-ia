import {
  createExpenseTool,
  getLotSummaryTool,
  listLotsTool,
  logMortalityTool,
  searchDocumentsTool,
} from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * "Registrar con IA" modal surface — write + supporting reads for
 * farm/lot operations. Per spec REQ-1 SCN-1.2.
 *
 * Post retire-farm-collapse-to-lot T23: `listFarmsTool` retirado. Farm
 * desaparece como concepto — `farmName` queda como texto libre en Lot
 * (REQ-200) y la UI lista directamente por lotes.
 */
export const MODAL_REGISTRAR_SURFACE: SurfaceBundle = {
  name: "modal-registrar",
  tools: [
    createExpenseTool,
    logMortalityTool,
    getLotSummaryTool,
    listLotsTool,
    searchDocumentsTool,
  ],
} as const;
