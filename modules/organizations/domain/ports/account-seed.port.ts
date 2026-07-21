/**
 * Outbound port for seeding the chart of accounts on org creation.
 * Wraps features/accounting AccountsService.seedChartOfAccounts.
 *
 * tx pattern: opaque token (`tx?: unknown`) — no Prisma leakage into the
 * port surface. Mirror: accounts-crud.port.ts / voucher-types.service.ts.
 * The infra adapter casts back internally.
 */
export interface AccountSeedPort {
  seedChartOfAccounts(
    organizationId: string,
    tx?: unknown,
  ): Promise<void>;
}
