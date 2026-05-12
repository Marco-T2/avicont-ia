/**
 * Outbound port for permission cache revalidation.
 * Wraps features/permissions/cache revalidateOrgMatrix.
 */
export interface PermissionCachePort {
  revalidateOrgMatrix(orgId: string): void;
}
