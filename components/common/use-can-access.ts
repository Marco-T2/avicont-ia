"use client";

import type { Action, Resource } from "@/features/shared/permissions";
import { useRolesMatrix } from "./roles-matrix-provider";

/**
 * useCanAccess — client-side gating hook.
 *
 * Reads from the <RolesMatrixProvider> context and evaluates against the
 * org's DYNAMIC permission matrix (D.3 / D.8). This is what closes the PR2
 * gap where <Gated> was still calling the sync 3-param static canAccess.
 *
 * Loading / no-provider: returns `false`. NEVER returns true during loading
 * — that would flash protected UI before the matrix resolves (U.1-S3).
 *
 * Real authorization lives server-side in requirePermission — this hook is
 * UX polish to hide controls the caller cannot invoke.
 */
export function useCanAccess(resource: Resource, action: Action): boolean {
  const matrix = useRolesMatrix();
  if (!matrix) return false;
  return matrix.canAccess(resource, action);
}
