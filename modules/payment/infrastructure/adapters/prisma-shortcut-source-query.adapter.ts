import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  ShortcutPurchase,
  ShortcutSale,
  ShortcutSourceQueryPort,
} from "../../domain/ports/shortcut-source-query.port";

/**
 * Prisma adapter for `ShortcutSourceQueryPort`. Implements the exact query
 * surface `fetchShortcutSource` (application layer) used to run inline
 * against `@/lib/prisma` before the [PRISMA] cluster paydown (D4). Runtime
 * behaviour is unchanged — same `findUnique` calls, same `include`d relation,
 * same field selection — only the caller no longer imports the live client.
 *
 * `balance` is coerced to `string` via `.toString()` here, at the boundary,
 * so the port stays Prisma-Decimal-free. The application helper builds its
 * own `decimal.js` `Decimal` from that string, identical to what it did
 * previously with `sale.receivable.balance.toString()`.
 */
export class PrismaShortcutSourceQueryAdapter implements ShortcutSourceQueryPort {
  async findSaleWithReceivable(id: string): Promise<ShortcutSale | null> {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { receivable: true },
    });

    if (!sale) return null;

    return {
      id: sale.id,
      organizationId: sale.organizationId,
      status: sale.status,
      contactId: sale.contactId,
      sequenceNumber: sale.sequenceNumber,
      referenceNumber: sale.referenceNumber,
      receivable: sale.receivable
        ? { id: sale.receivable.id, balance: sale.receivable.balance.toString() }
        : null,
    };
  }

  async findPurchaseWithPayable(id: string): Promise<ShortcutPurchase | null> {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { payable: true },
    });

    if (!purchase) return null;

    return {
      id: purchase.id,
      organizationId: purchase.organizationId,
      status: purchase.status,
      contactId: purchase.contactId,
      sequenceNumber: purchase.sequenceNumber,
      referenceNumber: purchase.referenceNumber,
      payable: purchase.payable
        ? { id: purchase.payable.id, balance: purchase.payable.balance.toString() }
        : null,
    };
  }
}
