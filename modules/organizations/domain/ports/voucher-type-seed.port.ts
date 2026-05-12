import type { Prisma } from "@/generated/prisma/client";

/**
 * Outbound port for seeding default voucher types on org creation.
 * Wraps modules/voucher-types VoucherTypesService.seedDefaultsForOrg.
 */
export interface VoucherTypeSeedPort {
  seedDefaultsForOrg(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
