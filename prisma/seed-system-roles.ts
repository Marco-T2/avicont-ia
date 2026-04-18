/**
 * seed-system-roles.ts — Idempotent seed for 6 system CustomRole rows per org.
 *
 * Reads all existing Organization rows and creates 6 system role rows per org
 * using the current static permission maps as source of truth.
 * Uses skipDuplicates=true for idempotency (safe to re-run).
 *
 * Usage: pnpm seed:system-roles
 */
import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  POST_ALLOWED_ROLES,
  SYSTEM_ROLES,
  type SystemRole,
  type Resource,
  type PostableResource,
} from "@/features/shared/permissions";

/**
 * Build the 6 system role payloads for a given orgId.
 * Derived directly from the current static maps so behavior is 1:1 on day one.
 */
export function buildSystemRolePayloads(orgId: string) {
  return SYSTEM_ROLES.map((slug: SystemRole) => {
    const permissionsRead = (Object.keys(PERMISSIONS_READ) as Resource[]).filter(
      (resource) => PERMISSIONS_READ[resource].includes(slug),
    );
    const permissionsWrite = (Object.keys(PERMISSIONS_WRITE) as Resource[]).filter(
      (resource) => PERMISSIONS_WRITE[resource].includes(slug),
    );
    const canPost = (Object.keys(POST_ALLOWED_ROLES) as PostableResource[]).filter(
      (resource) => POST_ALLOWED_ROLES[resource].includes(slug),
    );

    return {
      organizationId: orgId,
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      isSystem: true as const,
      permissionsRead,
      permissionsWrite,
      canPost,
    };
  });
}

/**
 * Idempotent seed: creates 6 system roles per org, skipping duplicates.
 * Exported for testability and for use as a runtime fallback (D.6).
 */
export async function seedSystemRoles(): Promise<void> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  for (const org of orgs) {
    const data = buildSystemRolePayloads(org.id);
    await prisma.customRole.createMany({ data, skipDuplicates: true });
  }
}

// Main entry point when run directly
if (require.main === module || process.argv[1]?.endsWith("seed-system-roles.ts")) {
  seedSystemRoles()
    .then(() => {
      console.log("System roles seeded successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
