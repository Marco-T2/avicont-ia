/**
 * Outbound port for seeding the canonical OperationalDocType catalog on org
 * creation. Wraps `prisma/seeds/operational-doc-types.ts.seedOperationalDocTypes`
 * via a thin adapter so the org-creation transaction stays
 * composition-root-wired (sister of VoucherTypeSeedPort).
 *
 * tx pattern: opaque token (`tx?: unknown`) — no Prisma leakage into the
 * port surface. Mirror: accounts-crud.port.ts / voucher-types.service.ts.
 * The infra adapter casts back internally.
 */
export interface OperationalDocTypeSeedPort {
  seedDefaultsForOrg(
    organizationId: string,
    tx?: unknown,
  ): Promise<void>;
}
