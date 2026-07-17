import "server-only";
import { revalidateOrgMatrix } from "@/modules/permissions/infrastructure/cache";
import type { PermissionCachePort } from "../../domain/ports/permission-cache.port";

/**
 * Legacy adapter: wraps features/permissions/cache revalidateOrgMatrix.
 */
export class LegacyPermissionCacheAdapter implements PermissionCachePort {
  revalidateOrgMatrix(orgId: string): void {
    revalidateOrgMatrix(orgId);
  }
}
