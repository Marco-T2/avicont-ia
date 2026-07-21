import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PurchaseContactReaderPort,
  PurchaseContactView,
} from "@/modules/purchase/domain/ports/purchase-contact-reader.port";

/**
 * Prisma directo adapter for `PurchaseContactReaderPort` (purchase-pure-read
 * — mirror sale-pure-read pilot). Mirror the legacy purchases/[purchaseId]
 * page `prisma.contact.findUnique` select projection, upgraded to `findFirst`
 * with `{ id, organizationId }` where for tenant scoping (paridad
 * `PrismaPurchaseRepository.findById`).
 *
 * Constructor flexible: `db = prisma` default — paridad con
 * `PrismaPurchaseRepository`.
 */

type DbClient = Pick<PrismaClient, "contact">;

export class PrismaPurchaseContactReaderAdapter
  implements PurchaseContactReaderPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async findById(
    organizationId: string,
    contactId: string,
  ): Promise<PurchaseContactView | null> {
    const row = await this.db.contact.findFirst({
      where: { id: contactId, organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        nit: true,
        paymentTermsDays: true,
      },
    });
    return row;
  }
}
