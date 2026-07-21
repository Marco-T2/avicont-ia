import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSystemRolePayloads } from "@/prisma/seed-system-roles";
import type { SystemRoleSeedPort } from "../../domain/ports/system-role-seed.port";

/**
 * Legacy adapter: wraps `@/prisma/seed-system-roles` buildSystemRolePayloads +
 * `customRole.createMany` so it satisfies SystemRoleSeedPort. When a tx client
 * is provided we use it (the org-creation flow runs inside `repo.transaction`);
 * otherwise fall back to the default prisma singleton.
 *
 * Mirror: legacy-operational-doc-type-seed.adapter.ts structure.
 */
export class LegacySystemRoleSeedAdapter implements SystemRoleSeedPort {
  async seedSystemRoles(
    organizationId: string,
    tx?: unknown,
  ): Promise<void> {
    const client = (tx ?? prisma) as Pick<PrismaClient, "customRole">;
    const data = buildSystemRolePayloads(organizationId);
    await client.customRole.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
