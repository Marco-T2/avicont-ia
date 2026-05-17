import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  type Role,
} from "@/modules/permissions/domain/permissions";
import type { Tool } from "../../ports/llm-provider.port.ts";
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

/**
 * Cross-filter a surface bundle by the role's permissions matrix.
 *
 * Pure domain — NO I/O, NO async. Narrows surface bundle → then RBAC.
 * A tool appears in the result iff it is in the surface bundle AND the
 * role is in `PERMISSIONS_READ[tool.resource]` (for read tools) or
 * `PERMISSIONS_WRITE[tool.resource]` (for write tools).
 *
 * Single source of truth: the permissions matrix. The legacy
 * `getToolsForRole` ad-hoc role→tool map is bypassed entirely.
 */
export function getToolsForSurface({
  surface,
  role,
}: {
  readonly surface: Surface;
  readonly role: Role;
}): Tool[] {
  const bundle = SURFACE_REGISTRY[surface];
  return bundle.tools.filter((t) => {
    const matrix = t.action === "read" ? PERMISSIONS_READ : PERMISSIONS_WRITE;
    return matrix[t.resource].includes(role);
  });
}
