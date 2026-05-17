import type { Tool } from "../../ports/llm-provider.port.ts";

/**
 * The three physical UI entry points that can dispatch the AI agent.
 * String literal union (NOT branded) — zod's `z.enum(SURFACES)` consumes
 * the tuple directly and `Surface` flows verbatim over HTTP. Branding would
 * force unwrap/rebrand at every layer with no semantic benefit.
 */
export const SURFACES = [
  "sidebar-qa",
  "modal-registrar",
  "modal-journal-ai",
] as const;

export type Surface = (typeof SURFACES)[number];

/**
 * A surface bundle is a curated set of tools available on a specific UI
 * entry point. The role gate (PERMISSIONS_READ / PERMISSIONS_WRITE) is
 * applied on top by `getToolsForSurface`.
 */
export interface SurfaceBundle {
  readonly name: Surface;
  readonly tools: readonly Tool[];
}
