"use client";

import type { ReactNode } from "react";
import { useOrgRole } from "./use-org-role";
import { canAccess } from "@/features/shared/permissions";
import type { Action, Resource } from "@/features/shared/permissions";

/**
 * Defensive UI gate. Returns false while role is loading or when there is no
 * role (logged-out or non-member). Once resolved, delegates to the matrix.
 *
 * Real authorization lives server-side in requirePermission (PR4) — this is
 * only UX polish to hide controls the caller cannot invoke.
 */
export function useCanAccess(resource: Resource, action: Action): boolean {
  const { role, isLoading } = useOrgRole();
  if (isLoading || !role) return false;
  return canAccess(role, resource, action);
}

export function Gated({
  resource,
  action,
  children,
}: {
  resource: Resource;
  action: Action;
  children: ReactNode;
}) {
  const allowed = useCanAccess(resource, action);
  if (!allowed) return null;
  return <>{children}</>;
}
