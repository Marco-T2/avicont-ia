import "server-only";

export * from "./permissions";

export {
  requirePermission,
  canAccess,
  canPost,
} from "./permissions.server";

export {
  getMatrix,
  revalidateOrgMatrix,
  ensureOrgSeeded,
  _setLoader,
  _resetCache,
} from "./permissions.cache";
export type { OrgMatrix } from "./permissions.cache";

export { buildClientMatrixSnapshot } from "./client-matrix";
