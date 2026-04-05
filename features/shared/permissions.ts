export type Role = "owner" | "admin" | "contador" | "member";

export type Resource = "members" | "accounting" | "accounting-config" | "farms" | "documents" | "agent" | "contacts";

export type DocumentScope = "ORGANIZATION" | "ACCOUNTING" | "FARM";

export const PERMISSIONS: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  accounting: ["owner", "admin", "contador"],
  "accounting-config": ["owner", "admin"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador", "member"],
  agent: ["owner", "admin", "contador", "member"],
  contacts: ["owner", "admin", "contador"],
};

/** Scopes each role can search via RAG. null = no RAG access. */
const RAG_SCOPES: Record<string, DocumentScope[]> = {
  owner: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  admin: ["ORGANIZATION", "ACCOUNTING", "FARM"],
  contador: ["ORGANIZATION", "ACCOUNTING"],
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

export function canAccess(role: string, resource: Resource): boolean {
  const allowed = PERMISSIONS[resource];
  return allowed.includes(role as Role);
}

export function getAccessibleResources(role: string): Resource[] {
  return (Object.keys(PERMISSIONS) as Resource[]).filter((resource) =>
    PERMISSIONS[resource].includes(role as Role),
  );
}
