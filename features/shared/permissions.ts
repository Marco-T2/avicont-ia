export type Role = "owner" | "admin" | "contador" | "member";

export type Resource = "members" | "accounting" | "farms" | "documents" | "agent";

export const PERMISSIONS: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  accounting: ["owner", "admin", "contador"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador", "member"],
  agent: ["owner", "admin", "contador", "member"],
};

export function canAccess(role: string, resource: Resource): boolean {
  const allowed = PERMISSIONS[resource];
  return allowed.includes(role as Role);
}

export function getAccessibleResources(role: string): Resource[] {
  return (Object.keys(PERMISSIONS) as Resource[]).filter((resource) =>
    PERMISSIONS[resource].includes(role as Role),
  );
}
