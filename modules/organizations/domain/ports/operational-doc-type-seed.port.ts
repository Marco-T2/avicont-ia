import type { Prisma } from "@/generated/prisma/client";

/**
 * Outbound port for seeding the canonical OperationalDocType catalog on org
 * creation. Wraps `prisma/seeds/operational-doc-types.ts.seedOperationalDocTypes`
 * via a thin adapter so the org-creation transaction stays
 * composition-root-wired (sister of VoucherTypeSeedPort).
 */
export interface OperationalDocTypeSeedPort {
  seedDefaultsForOrg(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
