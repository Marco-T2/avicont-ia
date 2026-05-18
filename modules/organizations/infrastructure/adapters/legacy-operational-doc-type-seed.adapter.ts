import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { seedOperationalDocTypes } from "../../../../prisma/seeds/operational-doc-types";
import type { OperationalDocTypeSeedPort } from "../../domain/ports/operational-doc-type-seed.port";

/**
 * Legacy adapter: wraps `prisma/seeds/operational-doc-types.ts` so it satisfies
 * the OperationalDocTypeSeedPort. When a tx client is provided we use it (the
 * org-creation flow runs inside `repo.transaction`); otherwise fall back to the
 * default prisma singleton.
 *
 * The seed only touches `operationalDocType.findFirst + create`, both of which
 * are available on `Prisma.TransactionClient`, so passing tx is a structural
 * subtype match against the `PrismaLike` slice declared in the seed module.
 */
export class LegacyOperationalDocTypeSeedAdapter
  implements OperationalDocTypeSeedPort
{
  async seedDefaultsForOrg(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = (tx ?? prisma) as unknown as Pick<
      PrismaClient,
      "operationalDocType" | "$disconnect"
    >;
    await seedOperationalDocTypes(organizationId, client);
  }
}
