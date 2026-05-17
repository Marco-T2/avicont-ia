import { MODAL_JOURNAL_AI_SURFACE } from "./modal-journal-ai.surface.ts";
import { MODAL_REGISTRAR_SURFACE } from "./modal-registrar.surface.ts";
import { SIDEBAR_QA_SURFACE } from "./sidebar-qa.surface.ts";
import { SURFACES, type Surface, type SurfaceBundle } from "./surface.types.ts";

export { SURFACES } from "./surface.types.ts";
export type { Surface, SurfaceBundle } from "./surface.types.ts";

/**
 * Static registry of surface bundles. Single import site for downstream
 * consumers (resolver, sentinel, route handler, schema).
 */
export const SURFACE_REGISTRY: Record<Surface, SurfaceBundle> = {
  "sidebar-qa": SIDEBAR_QA_SURFACE,
  "modal-registrar": MODAL_REGISTRAR_SURFACE,
  "modal-journal-ai": MODAL_JOURNAL_AI_SURFACE,
};
