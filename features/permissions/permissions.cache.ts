/** Re-exports moved to hex (§13.INFRASTRUCTURE canonical home). Named re-exports + export type for isolatedModules + module-scope Map singleton preserved via pure re-export. */
export {
  getMatrix,
  revalidateOrgMatrix,
  ensureOrgSeeded,
  _setLoader,
  _resetCache,
} from "@/modules/permissions/infrastructure/permissions.cache";
export type { OrgMatrix } from "@/modules/permissions/infrastructure/permissions.cache";
