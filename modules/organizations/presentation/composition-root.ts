import "server-only";

import { OrganizationsService } from "../application/organizations.service";
import { MembersService } from "../application/members.service";
import { RolesService } from "../application/roles.service";
import { EnsureFromClerkService } from "../application/ensure-from-clerk.service";
import { PrismaOrganizationsRepository } from "../infrastructure/prisma-organizations.repository";
import { PrismaRolesRepository } from "../infrastructure/prisma-roles.repository";
import { LegacyClerkAuthAdapter } from "../infrastructure/adapters/legacy-clerk-auth.adapter";
import { LegacyUserResolutionAdapter } from "../infrastructure/adapters/legacy-user-resolution.adapter";
import { LegacyAccountSeedAdapter } from "../infrastructure/adapters/legacy-account-seed.adapter";
import { LegacyVoucherTypeSeedAdapter } from "../infrastructure/adapters/legacy-voucher-type-seed.adapter";
import { LegacySystemRoleSeedAdapter } from "../infrastructure/adapters/legacy-system-role-seed.adapter";
import { LegacyPermissionCacheAdapter } from "../infrastructure/adapters/legacy-permission-cache.adapter";

/**
 * Composition root for the organizations module (POC organizations-hex).
 * Single point of wiring concrete adapters to services.
 * Mirror: modules/dispatch/presentation/composition-root.ts pattern.
 */
export function makeOrganizationsService(): OrganizationsService {
  return new OrganizationsService({
    repo: new PrismaOrganizationsRepository(),
    users: new LegacyUserResolutionAdapter(),
    voucherTypeSeed: new LegacyVoucherTypeSeedAdapter(),
    accountSeed: new LegacyAccountSeedAdapter(),
    systemRoleSeed: new LegacySystemRoleSeedAdapter(),
  });
}

export function makeMembersService(): MembersService {
  return new MembersService({
    repo: new PrismaOrganizationsRepository(),
    users: new LegacyUserResolutionAdapter(),
    clerkAuth: new LegacyClerkAuthAdapter(),
  });
}

export function makeRolesService(
  getCallerRoleSlug: (orgId: string, caller: { clerkUserId: string }) => Promise<string | null>,
): RolesService {
  return new RolesService({
    repo: new PrismaRolesRepository(),
    permissionCache: new LegacyPermissionCacheAdapter(),
    getCallerRoleSlug,
  });
}

/**
 * Read-only RolesService for validation singletons.
 * getCallerRoleSlug is a no-op — only `exists` is called.
 */
export function makeReadOnlyRolesService(): RolesService {
  return new RolesService({
    repo: new PrismaRolesRepository(),
    permissionCache: new LegacyPermissionCacheAdapter(),
    getCallerRoleSlug: async () => null,
  });
}

let _ensureFromClerkInstance: EnsureFromClerkService | undefined;

/**
 * Lazy-sync service: keeps DB ↔ Clerk in step on each `requirePermission`
 * call. Memoized — single instance per process. See ensure-from-clerk.service
 * for the contract and trade-offs.
 */
export function makeEnsureFromClerkService(): EnsureFromClerkService {
  if (_ensureFromClerkInstance) return _ensureFromClerkInstance;
  _ensureFromClerkInstance = new EnsureFromClerkService({
    clerkAuth: new LegacyClerkAuthAdapter(),
    organizations: makeOrganizationsService(),
    members: makeMembersService(),
  });
  return _ensureFromClerkInstance;
}

/** Test-only: reset the memoized EnsureFromClerkService instance. */
export function __resetEnsureFromClerkForTesting(): void {
  _ensureFromClerkInstance = undefined;
}
