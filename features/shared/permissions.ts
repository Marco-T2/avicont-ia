/**
 * Role is widened to string to support custom roles per organization (PR1.2 / D.8).
 * Use SystemRole for guards that apply only to the 6 built-in slugs.
 */
export type Role = string;

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

export const POST_ALLOWED_ROLES: Record<PostableResource, Role[]> = {
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  journal: ["owner", "admin", "contador"],
};

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

export function canAccess(
  role: string,
  resource: Resource,
  action: Action,
): boolean {
  const map = action === "read" ? PERMISSIONS_READ : PERMISSIONS_WRITE;
  return map[resource].includes(role as Role);
}

export function canPost(role: string, resource: PostableResource): boolean {
  return POST_ALLOWED_ROLES[resource].includes(role as Role);
}
