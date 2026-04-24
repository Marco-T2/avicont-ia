"use client";

import type { ReactNode } from "react";
import type { Action, Resource } from "@/features/permissions";
import { useCanAccess } from "./use-can-access";

/**
 * Defensive UI gate. Returns false while the client matrix is loading (no
 * provider yet, or snapshot=null). Once resolved, delegates to the dynamic
 * matrix via useCanAccess — so custom roles and admin edits are reflected
 * without any static-map fallback (PR7.1 / D.8 / U.1mod).
 *
 * Real authorization lives server-side in requirePermission — this is only
 * UX polish to hide controls the caller cannot invoke.
 *
 * Public props API is frozen: {resource, action, children}. Do not change
 * without a spec update.
 */
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
