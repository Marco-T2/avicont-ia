import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PurchasePayableReaderPort,
  PurchasePayableView,
} from "@/modules/purchase/domain/ports/purchase-payable-reader.port";

/**
 * Prisma directo adapter for `PurchasePayableReaderPort` (purchase-pure-read
 * — mirror sale-pure-read pilot). Mirror the legacy purchases/[purchaseId]
 * page `prisma.accountsPayable.findUnique` select projection (nested
 * allocations + payment ordered by payment.date asc), upgraded to `findFirst`
 * with `{ id, organizationId }` where for tenant scoping (paridad
 * `PrismaPurchaseRepository.findById`).
 *
 * Decimal→number conversion happens HERE (infrastructure boundary) so the
 * port view never leaks `Prisma.Decimal` into domain/presentation.
 *
 * Constructor flexible: `db = prisma` default — paridad con
 * `PrismaPurchaseRepository`.
 */

type DbClient = Pick<PrismaClient, "accountsPayable">;

export class PrismaPurchasePayableReaderAdapter
  implements PurchasePayableReaderPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async findWithAllocations(
    organizationId: string,
    payableId: string,
  ): Promise<PurchasePayableView | null> {
    const row = await this.db.accountsPayable.findFirst({
      where: { id: payableId, organizationId },
      select: {
        id: true,
        amount: true,
        paid: true,
        balance: true,
        status: true,
        dueDate: true,
        allocations: {
          select: {
            id: true,
            paymentId: true,
            amount: true,
            payment: {
              select: { id: true, date: true, description: true },
            },
          },
          orderBy: { payment: { date: "asc" as const } },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      amount: row.amount.toNumber(),
      paid: row.paid.toNumber(),
      balance: row.balance.toNumber(),
      status: row.status,
      dueDate: row.dueDate,
      allocations: row.allocations.map((allocation) => ({
        id: allocation.id,
        paymentId: allocation.paymentId,
        amount: allocation.amount.toNumber(),
        payment: {
          id: allocation.payment.id,
          date: allocation.payment.date,
          description: allocation.payment.description,
        },
      })),
    };
  }
}
