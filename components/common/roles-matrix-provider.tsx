"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  Action,
  PostableResource,
  Resource,
} from "@/features/permissions";

/**
 * ClientMatrixSnapshot — serializable shape fetched server-side and passed
 * through a "use client" boundary. The four scalars cover the full gating
 * decision surface for the caller in the current org.
 *
 * Why not ship OrgMatrix itself (D.3)? It uses Map/Set which do not survive
 * the RSC → Client Component serialization boundary. We project the caller's
 * row only (not the full matrix) — plenty for gating, and keeps the payload
 * small. If/when the admin matrix editor needs the full per-role view, it
 * fetches the full list via /api/organizations/[orgSlug]/roles on demand.
 */
export type ClientMatrixSnapshot = {
  orgId: string;
  role: string; // caller's role slug — may be a system slug or a custom slug
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
};

/**
 * ClientMatrix — the runtime shape exposed to consumers via context.
 * Internally stores permission arrays as `Set<string>` for O(1) lookups (D.3).
 *
 * Functions are stable per snapshot (useMemo'd in the provider) so
 * useCanAccess doesn't churn through re-renders.
 */
export type ClientMatrix = {
  orgId: string;
  role: string;
  canAccess(resource: Resource, action: Action): boolean;
  canPost(resource: PostableResource): boolean;
};

const RolesMatrixContext = createContext<ClientMatrix | null>(null);

/**
 * RolesMatrixProvider — wraps the dashboard tree with the current caller's
 * client-side permission matrix.
 *
 * Usage (Option B — server-side fetch, no loading flash):
 *
 * ```tsx
 * // app/(dashboard)/[orgSlug]/layout.tsx — Server Component
 * const snapshot = await buildClientMatrixSnapshot(orgId, role);
 * return (
 *   <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>
 * );
 * ```
 *
 * Passing `snapshot={null}` signals loading/unknown — consumers (Gated,
 * useCanAccess) deny by default to avoid flashing protected UI.
 */
export function RolesMatrixProvider({
  snapshot,
  children,
}: {
  snapshot: ClientMatrixSnapshot | null;
  children: ReactNode;
}) {
  const matrix = useMemo<ClientMatrix | null>(() => {
    if (snapshot === null) return null;
    const read = new Set<string>(snapshot.permissionsRead);
    const write = new Set<string>(snapshot.permissionsWrite);
    const post = new Set<string>(snapshot.canPost);
    return {
      orgId: snapshot.orgId,
      role: snapshot.role,
      canAccess(resource: Resource, action: Action): boolean {
        return action === "read" ? read.has(resource) : write.has(resource);
      },
      canPost(resource: PostableResource): boolean {
        return post.has(resource);
      },
    };
  }, [snapshot]);

  return (
    <RolesMatrixContext.Provider value={matrix}>
      {children}
    </RolesMatrixContext.Provider>
  );
}

/**
 * Low-level hook: returns the full ClientMatrix or null (loading / no
 * provider). Most call sites should prefer useCanAccess, but the admin role
 * editor may need the raw object to introspect the caller's role slug.
 */
export function useRolesMatrix(): ClientMatrix | null {
  return useContext(RolesMatrixContext);
}
