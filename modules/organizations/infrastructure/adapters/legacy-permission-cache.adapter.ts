import "server-only";
import { revalidateOrgMatrix } from "@/features/permissions/cache";
import type { PermissionCachePort } from "../../domain/ports/permission-cache.port";

/**
 * Legacy adapter: wraps features/permissions/cache revalidateOrgMatrix.
 */
export class LegacyPermissionCacheAdapter implements PermissionCachePort {
  revalidateOrgMatrix(orgId: string): void {
    revalidateOrgMatrix(orgId);
  }
}
