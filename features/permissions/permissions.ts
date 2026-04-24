/**
 * Role is widened to string to support custom roles per organization (PR1.2 / D.8).
 * Use SystemRole for guards that apply only to the 5 built-in slugs.
 */
export type Role = string;

export const SYSTEM_ROLES = [
  "owner",
  "admin",
  "contador",
  "cobrador",
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
  | "agent"
  | "period";

export type Action = "read" | "write" | "close" | "reopen";

export type DocumentScope = "ORGANIZATION" | "ACCOUNTING" | "FARM";

export const PERMISSIONS_READ: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "cobrador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "contador"],
  reports: ["owner", "admin", "contador", "cobrador"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador", "cobrador", "member"],
  agent: ["owner", "admin", "contador", "cobrador", "member"],
  // period: anyone with RBAC access can read period state
  period: ["owner", "admin"],
};

export const PERMISSIONS_WRITE: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin"],
  reports: ["owner", "admin"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador"],
  agent: ["owner", "admin", "contador", "cobrador", "member"],
  // period: write gate for metadata CRUD (create fiscal year, edit OPEN period metadata).
  // Close/reopen state transitions use PERMISSIONS_CLOSE and PERMISSIONS_REOPEN respectively.
  period: ["owner", "admin"],
};

/**
 * Roles allowed to CLOSE a period (action: 'close').
 * All resources default to [] except 'period'.
 */
export const PERMISSIONS_CLOSE: Record<Resource, Role[]> = {
  members: [],
  "accounting-config": [],
  sales: [],
  purchases: [],
  payments: [],
  journal: [],
  dispatches: [],
  reports: [],
  contacts: [],
  farms: [],
  documents: [],
  agent: [],
  period: ["owner", "admin"],
};

/**
 * Roles allowed to REOPEN a period (action: 'reopen').
 * All resources default to [] except 'period'.
 */
export const PERMISSIONS_REOPEN: Record<Resource, Role[]> = {
  members: [],
  "accounting-config": [],
  sales: [],
  purchases: [],
  payments: [],
  journal: [],
  dispatches: [],
  reports: [],
  contacts: [],
  farms: [],
  documents: [],
  agent: [],
  period: ["owner", "admin"],
};

export type PostableResource = "sales" | "purchases" | "journal";

/**
 * Seed source for system-role `canPost` defaults.
 * Used by buildSystemRolePayloads (prisma/seed-system-roles.ts) to seed day-one rows,
 * and by the UI (roles-permissions-matrix.tsx) to display system defaults.
 * Access via getPostAllowedRoles() — not part of the public API.
 * PR8.2: removed `export` keyword.
 * PR8.3: removed stale reference to sync 2-param canPost backward-compat path.
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
  member: ["ORGANIZATION", "FARM"],
};

/** Scopes each role can upload documents to. null = no upload. */
const UPLOAD_SCOPES: Record<string, DocumentScope[]> = {
  owner: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  admin: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  contador: ["ACCOUNTING"],
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

// NOTE: async canAccess() and canPost() were moved to permissions.server.ts
// (with "server-only" guard) to prevent the permissions.cache → prisma → pg → dns
// module chain from being bundled into client chunks.
// Client-side permission checks use useCanAccess() / <Gated> (PR7.1).
