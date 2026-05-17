import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  PayableLedgerEnrichmentRow,
  PayablesContactLedgerPort,
} from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";

/**
 * Prisma adapter for the contact-ledger payable enrichment lookup.
 *
 * Symmetric sister of `PrismaReceivablesContactLedgerAdapter` — same batched
 * findMany + journalEntryId narrow + minimal projection. See sister adapter
 * JSDoc for the N+1 mitigation rationale.
 */
type DbClient = Pick<PrismaClient, "accountsPayable">;

export class PrismaPayablesContactLedgerAdapter
  implements PayablesContactLedgerPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<PayableLedgerEnrichmentRow[]> {
    if (journalEntryIds.length === 0) return [];
    const rows = await this.db.accountsPayable.findMany({
      where: {
        organizationId,
        journalEntryId: { in: journalEntryIds },
      },
      select: {
        journalEntryId: true,
        status: true,
        dueDate: true,
      },
    });
    return rows
      .filter((r): r is typeof r & { journalEntryId: string } =>
        r.journalEntryId !== null,
      )
      .map((r) => ({
        journalEntryId: r.journalEntryId,
        status: r.status,
        dueDate: r.dueDate,
      }));
  }
}
