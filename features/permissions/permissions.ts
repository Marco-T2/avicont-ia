/** Re-exports moved to hex (§13.DOMAIN canonical home). Named re-exports + export type for isolatedModules discipline. */
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
