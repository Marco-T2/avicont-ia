import "server-only";

// Cache-only barrel: exposes matrix cache primitives without loading the
// auth gates (requirePermission / canAccess / canPost). Gates depend on
// `@/modules/organizations/presentation/server`, which in turn consumes these
// primitives (roles.service invalidates the cache on role changes).
// Routing the invalidation consumer through `./server` creates an import
// cycle; this barrel breaks it by exposing only the cache API.

export * from "./permissions.cache";
