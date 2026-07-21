/**
 * Outbound port for seeding default voucher types on org creation.
 * Wraps modules/voucher-types VoucherTypesService.seedDefaultsForOrg.
 *
 * tx pattern: opaque token (`tx?: unknown`) — no Prisma leakage into the
 * port surface. Mirror: accounts-crud.port.ts / voucher-types.service.ts.
 * The infra adapter casts back internally.
 */
export interface VoucherTypeSeedPort {
  seedDefaultsForOrg(
    organizationId: string,
    tx?: unknown,
  ): Promise<void>;
}
