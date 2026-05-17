import { parseAccountingOperationToSuggestionTool } from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * Accounting journal-entry-ai modal — single-tool, single-turn capture
 * of structured journal-entry suggestions. Per spec REQ-1 SCN-1.3.
 */
export const MODAL_JOURNAL_AI_SURFACE: SurfaceBundle = {
  name: "modal-journal-ai",
  tools: [parseAccountingOperationToSuggestionTool],
} as const;
