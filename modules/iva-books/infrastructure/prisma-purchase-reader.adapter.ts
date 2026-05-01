import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PurchaseReaderPort,
  PurchaseSnapshot,
} from "../domain/ports/purchase-reader.port";

type DbClient = Pick<PrismaClient, "purchase">;

/**
 * Narrow snapshot read for IVA-hex consumer — `prisma.purchase.findFirst`
 * con tenancy guard inline `where: { id, organizationId }` y `select`
 * query-level que retorna directo el shape `PurchaseSnapshot` (20+→3 fields).
 * NO post-hydration map (row shape == port shape post-`select`). Mirror A1
 * purchase-hex tenancy pattern (NO shared helper).
 */
export class PrismaPurchaseReaderAdapter implements PurchaseReaderPort {
  constructor(private readonly db: DbClient = prisma) {}

  async getById(
    organizationId: string,
    purchaseId: string,
  ): Promise<PurchaseSnapshot | null> {
    return this.db.purchase.findFirst({
      where: { id: purchaseId, organizationId },
      select: { id: true, organizationId: true, status: true },
    });
  }
}
