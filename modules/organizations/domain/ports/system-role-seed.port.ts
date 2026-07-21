/**
 * Outbound port for seeding the 5 system CustomRole rows on org creation.
 * Wraps `prisma/seed-system-roles.ts` buildSystemRolePayloads + the
 * `customRole.createMany` write, so `OrganizationsService.syncOrganization`
 * no longer touches `tx.customRole.createMany` directly (raw Prisma access
 * leaking through the structurally-typed tx handle).
 *
 * tx pattern: opaque token (`tx?: unknown`) — no Prisma leakage into the
 * port surface. Mirror: accounts-crud.port.ts / voucher-types.service.ts.
 * The infra adapter casts back internally.
 */
export interface SystemRoleSeedPort {
  seedSystemRoles(
    organizationId: string,
    tx?: unknown,
  ): Promise<void>;
}
