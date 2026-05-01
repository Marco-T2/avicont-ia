import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  SaleReaderPort,
  SaleSnapshot,
} from "../domain/ports/sale-reader.port";

type DbClient = Pick<PrismaClient, "sale">;

/**
 * Narrow snapshot read for IVA-hex consumer — `prisma.sale.findFirst` con
 * tenancy guard inline `where: { id, organizationId }` y `select` query-level
 * que retorna directo el shape `SaleSnapshot` (12+→3 fields). NO post-
 * hydration map (row shape == port shape post-`select`). Mirror A1 sale-hex
 * tenancy pattern (NO shared helper).
 */
export class PrismaSaleReaderAdapter implements SaleReaderPort {
  constructor(private readonly db: DbClient = prisma) {}

  async getById(
    organizationId: string,
    saleId: string,
  ): Promise<SaleSnapshot | null> {
    return this.db.sale.findFirst({
      where: { id: saleId, organizationId },
      select: { id: true, organizationId: true, status: true },
    });
  }
}
