import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  SaleContactReaderPort,
  SaleContactView,
} from "@/modules/sale/domain/ports/sale-contact-reader.port";

/**
 * Prisma directo adapter for `SaleContactReaderPort` (sale-pure-read pilot).
 * Mirror the legacy sales/[saleId] page `prisma.contact.findUnique` select
 * projection, upgraded to `findFirst` with `{ id, organizationId }` where for
 * tenant scoping (paridad `PrismaSaleRepository.findById`).
 *
 * Constructor flexible: `db = prisma` default — paridad con
 * `PrismaSaleRepository`.
 */

type DbClient = Pick<PrismaClient, "contact">;

export class PrismaSaleContactReaderAdapter implements SaleContactReaderPort {
  constructor(private readonly db: DbClient = prisma) {}

  async findById(
    organizationId: string,
    contactId: string,
  ): Promise<SaleContactView | null> {
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
