import "server-only";
import { prisma } from "@/lib/prisma";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { DispatchAccountBalancesPort } from "../domain/ports/dispatch-account-balances.port";

/**
 * Adapter: bridges DispatchAccountBalancesPort (journalEntryId) →
 * AccountBalancesService (tx + entity). Opens a Prisma transaction,
 * loads the journal entry with required relations, delegates to the service.
 */
export class LegacyAccountBalancesAdapter
  implements DispatchAccountBalancesPort
{
  private readonly service: AccountBalancesService;

  constructor() {
    this.service = new AccountBalancesService();
  }

  async applyPost(journalEntryId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirstOrThrow({
        where: { id: journalEntryId },
        include: {
          lines: {
            include: { account: true, contact: true },
            orderBy: { order: "asc" as const },
          },
          contact: true,
          voucherType: true,
        },
      });
      await this.service.applyPost(tx, entry as never);
    });
  }

  async applyVoid(journalEntryId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirstOrThrow({
        where: { id: journalEntryId },
        include: {
          lines: {
            include: { account: true, contact: true },
            orderBy: { order: "asc" as const },
          },
          contact: true,
          voucherType: true,
        },
      });
      await this.service.applyVoid(tx, entry as never);
    });
  }
}
