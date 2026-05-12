/**
 * Outbound port for building system role payloads on org creation.
 * Wraps @/prisma/seed-system-roles buildSystemRolePayloads.
 */
export interface SystemRoleSeedPort {
  buildSystemRolePayloads(orgId: string): Array<{
    organizationId: string;
    slug: string;
    name: string;
    description: string;
    isSystem: boolean;
    permissionsRead: string[];
    permissionsWrite: string[];
    canPost: string[];
  }>;
}
