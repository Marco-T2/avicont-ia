import { searchDocumentsTool } from "../agent.tool-definitions.ts";
import type { SurfaceBundle } from "./surface.types.ts";

/**
 * Read-only Q&A surface (sidebar chat). Only RAG search; no write tools,
 * no farm reads. Per spec REQ-1 SCN-1.1.
 */
export const SIDEBAR_QA_SURFACE: SurfaceBundle = {
  name: "sidebar-qa",
  tools: [searchDocumentsTool],
} as const;
