import type { Prisma } from "@/generated/prisma/client";

/**
 * Outbound port for seeding the chart of accounts on org creation.
 * Wraps features/accounting AccountsService.seedChartOfAccounts.
 */
export interface AccountSeedPort {
  seedChartOfAccounts(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
