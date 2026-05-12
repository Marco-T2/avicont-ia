import "server-only";

/** Aggregate re-export barrel; relocated to hex (§13.APPLICATION canonical home). Named re-exports preserve spy/mock surface on @/features/permissions/server (84 vi.mock + 1 vi.spyOn canPost). */
export {
  SYSTEM_ROLES,
  isSystemRole,
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  PERMISSIONS_CLOSE,
  PERMISSIONS_REOPEN,
  getPostAllowedRoles,
  getRagScopes,
  getUploadScopes,
  canUploadToScope,
} from "@/modules/permissions/domain/permissions";
export type {
  Role,
  SystemRole,
  Resource,
  Action,
  DocumentScope,
  PostableResource,
} from "@/modules/permissions/domain/permissions";

export {
  requirePermission,
  canAccess,
  canPost,
} from "@/modules/permissions/application/permissions.server";

export { _setLoader, _resetCache } from "@/modules/permissions/infrastructure/permissions.cache";
export type { OrgMatrix } from "@/modules/permissions/infrastructure/permissions.cache";

export { buildClientMatrixSnapshot } from "@/modules/permissions/application/client-matrix";
