import "server-only";

export * from "./permissions";

export {
  requirePermission,
  canAccess,
  canPost,
} from "./permissions.server";

// Cache primitives exposed for test hooks (loader injection, cache reset).
// Production consumers that need invalidation should use the `./cache` barrel
// — see organizations/roles.service.ts for precedent.
export { _setLoader, _resetCache } from "./permissions.cache";
export type { OrgMatrix } from "./permissions.cache";

export { buildClientMatrixSnapshot } from "./client-matrix";
