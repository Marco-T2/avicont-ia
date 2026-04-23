/**
 * PR4.2 [GREEN] — buildSyntheticMatrix() pure util
 * REQ-RM.11
 *
 * Builds a transient matrix object from the current toggle state (readSet +
 * writeSet). Used exclusively by RoleSidebarPreview to gate nav-item visibility
 * without touching useRolesMatrix(), Clerk, or any server-fetched data.
 *
 * Design contract:
 *  - canPost intentionally ABSENT — preview gates navigation visibility only;
 *    "Registrar" is a per-row affordance in the matrix, not a navigable route.
 *  - Pure function — no side effects, no closures over external state.
 *  - 1–3 line body (per design §3 synthetic matrix contract).
 */

import type { Resource } from "@/features/shared/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyntheticMatrix = {
  canAccess: (resource: Resource, action: "read" | "write") => boolean;
  // canPost intentionally NOT here — see design §3 and REQ-RM.11
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Builds a synthetic matrix from the two Sets that power the matrix checkboxes.
 *
 * @param readSet  - Resources checked in the Ver (read) column
 * @param writeSet - Resources checked in the Editar (write) column
 */
export function buildSyntheticMatrix(
  readSet: Set<Resource>,
  writeSet: Set<Resource>,
): SyntheticMatrix {
  return {
    canAccess: (r: Resource, action: "read" | "write") =>
      action === "read" ? readSet.has(r) : writeSet.has(r),
  };
}
