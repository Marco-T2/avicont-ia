/**
 * Role is widened to string to support custom roles per organization (PR1.2 / D.8).
 * Use SystemRole for guards that apply only to the 6 built-in slugs.
 */
export type Role = string;

// Lazy import to avoid circular deps at module load time
const getCacheModule = () => import("./permissions.cache");

export const SYSTEM_ROLES = [
  "owner",
  "admin",
  "contador",
  "cobrador",
  "auxiliar",
  "member",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export function isSystemRole(slug: string): slug is SystemRole {
  return (SYSTEM_ROLES as readonly string[]).includes(slug);
}

export type Resource =
  | "members"
  | "accounting-config"
  | "sales"
  | "purchases"
  | "payments"
  | "journal"
  | "dispatches"
  | "reports"
  | "contacts"
  | "farms"
  | "documents"
  | "agent";

export type Action = "read" | "write";

export type DocumentScope = "ORGANIZATION" | "ACCOUNTING" | "FARM";

export const PERMISSIONS_READ: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "cobrador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "contador", "auxiliar"],
  reports: ["owner", "admin", "contador", "cobrador"],
  contacts: ["owner", "admin", "contador", "cobrador", "auxiliar"],
  farms: ["owner", "admin", "contador", "auxiliar", "member"],
  documents: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
  agent: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
};

export const PERMISSIONS_WRITE: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "auxiliar"],
  purchases: ["owner", "admin", "contador", "auxiliar"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "auxiliar"],
  reports: ["owner", "admin"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "auxiliar", "member"],
  documents: ["owner", "admin", "contador"],
  agent: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
};

export type PostableResource = "sales" | "purchases" | "journal";

/**
 * Static map used internally for the sync canPost 2-param overload.
 * Not exported — production code uses the async 3-param canPost(role, resource, orgId)
 * which reads from the org's cached matrix. This map is only kept for:
 *   1. The sync 2-param canPost backward compat path (journal.service.ts)
 *   2. seed-system-roles.ts buildSystemRolePayloads (seeding day-one rows)
 * PR8.2: removed `export` keyword — import via buildSystemRolePayloads if needed.
 */
const POST_ALLOWED_ROLES: Record<PostableResource, Role[]> = {
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  journal: ["owner", "admin", "contador"],
};

/**
 * Returns the static canPost map for internal use by seed helpers.
 * Used by buildSystemRolePayloads in prisma/seed-system-roles.ts.
 * @internal — not part of the public API.
 */
export function getPostAllowedRoles(): Readonly<Record<PostableResource, Role[]>> {
  return POST_ALLOWED_ROLES;
}

/** Scopes each role can search via RAG. null = no RAG access. */
const RAG_SCOPES: Record<string, DocumentScope[]> = {
  owner: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  admin: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  contador: ["ORGANIZATION", "ACCOUNTING"],
  cobrador: ["ORGANIZATION"],
  auxiliar: ["ORGANIZATION", "FARM"],
  member: ["ORGANIZATION", "FARM"],
};

/** Scopes each role can upload documents to. null = no upload. */
const UPLOAD_SCOPES: Record<string, DocumentScope[]> = {
  owner: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  admin: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  contador: ["ACCOUNTING"],
  auxiliar: ["FARM"],
  member: ["FARM"],
};

export function getRagScopes(role: string): DocumentScope[] | null {
  return RAG_SCOPES[role] ?? null;
}

export function getUploadScopes(role: string): DocumentScope[] | null {
  return UPLOAD_SCOPES[role] ?? null;
}

export function canUploadToScope(role: string, scope: DocumentScope): boolean {
  const allowed = UPLOAD_SCOPES[role];
  return allowed ? allowed.includes(scope) : false;
}

/**
 * Async — reads from the org's cached permission matrix.
 * Use this in server-side code. The cache handles TTL, single-flight, and
 * the fallback seed is handled by requirePermission / getMatrix. (D.7 / P.2mod)
 *
 * PR8.2: sync 3-param overload removed — all callers must pass orgId.
 * Client-side permission checks go through useCanAccess() / <Gated> (PR7.1).
 */
export function canAccess(
  role: string,
  resource: Resource,
  action: Action,
  orgId: string,
): Promise<boolean> {
  return getCacheModule().then(({ getMatrix }) =>
    getMatrix(orgId).then((matrix) => {
      const roleEntry = matrix.roles.get(role);
      if (!roleEntry) return false;
      return action === "read"
        ? roleEntry.permissionsRead.has(resource)
        : roleEntry.permissionsWrite.has(resource);
    }),
  );
}

/**
 * Sync 2-param overload — uses static POST_ALLOWED_ROLES map.
 * Kept for backward compat (journal.service, existing tests). (D.7)
 */
export function canPost(role: string, resource: PostableResource): boolean;

/**
 * Async 3-param overload — reads from the org's cached permission matrix.
 * Use this in server-side service code (sale.service, purchase.service). (D.7 / P.6)
 */
export function canPost(
  role: string,
  resource: PostableResource,
  orgId: string,
): Promise<boolean>;

export function canPost(
  role: string,
  resource: PostableResource,
  orgId?: string,
): boolean | Promise<boolean> {
  if (orgId !== undefined) {
    // Async path: look up from cached matrix
    return getCacheModule().then(({ getMatrix }) =>
      getMatrix(orgId).then((matrix) => {
        const roleEntry = matrix.roles.get(role);
        if (!roleEntry) return false;
        return roleEntry.canPost.has(resource);
      }),
    );
  }
  // Sync path: use static map (backward compat)
  return POST_ALLOWED_ROLES[resource].includes(role as Role);
}
