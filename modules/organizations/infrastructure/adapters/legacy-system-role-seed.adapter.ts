import "server-only";
import { buildSystemRolePayloads } from "@/prisma/seed-system-roles";
import type { SystemRoleSeedPort } from "../../domain/ports/system-role-seed.port";

/**
 * Legacy adapter: wraps @/prisma/seed-system-roles buildSystemRolePayloads.
 */
export class LegacySystemRoleSeedAdapter implements SystemRoleSeedPort {
  buildSystemRolePayloads(orgId: string) {
    return buildSystemRolePayloads(orgId);
  }
}
