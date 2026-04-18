/**
 * Test-only helper — build a ClientMatrixSnapshot for a SYSTEM role from
 * the static permission maps, so legacy RBAC component tests (sale-form,
 * purchase-form, journal-entry-detail, etc.) can wrap the component under
 * test with a RolesMatrixProvider without spelling the matrix by hand.
 *
 * This file lives under __tests__/ so it is NOT part of the production
 * bundle. Only test files import it.
 *
 * Example:
 *   render(
 *     <SystemRoleProvider role="auxiliar">
 *       <SaleForm ... />
 *     </SystemRoleProvider>,
 *   );
 */
import type { ReactNode } from "react";
import {
  RolesMatrixProvider,
  type ClientMatrixSnapshot,
} from "@/components/common/roles-matrix-provider";
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  POST_ALLOWED_ROLES,
  type Resource,
  type PostableResource,
} from "@/features/shared/permissions";

export function buildSystemRoleSnapshot(
  role: string,
  orgId = "test-org-id",
): ClientMatrixSnapshot {
  const read: string[] = [];
  const write: string[] = [];
  for (const resource of Object.keys(PERMISSIONS_READ) as Resource[]) {
    if (PERMISSIONS_READ[resource].includes(role)) read.push(resource);
    if (PERMISSIONS_WRITE[resource].includes(role)) write.push(resource);
  }
  const post: string[] = [];
  for (const resource of Object.keys(POST_ALLOWED_ROLES) as PostableResource[]) {
    if (POST_ALLOWED_ROLES[resource].includes(role)) post.push(resource);
  }
  return {
    orgId,
    role,
    permissionsRead: read,
    permissionsWrite: write,
    canPost: post,
  };
}

/**
 * Convenience wrapper for tests that just need to grant a system role's
 * permissions via <RolesMatrixProvider>.
 */
export function SystemRoleProvider({
  role,
  orgId = "test-org-id",
  children,
}: {
  role: string | null;
  orgId?: string;
  children: ReactNode;
}) {
  const snapshot = role === null ? null : buildSystemRoleSnapshot(role, orgId);
  return (
    <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>
  );
}
