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
 * journal-physical-document Phase 5 simplification: dropped the
 * `purchase.findMany` batched lookup — `documentTypeCode` +
 * `documentReferenceNumber` are now read off the JE row directly in
 * `LedgerService.getContactLedgerPaginated`. Net effect: 1 fewer DB query
 * per page; no more PurchaseType enum→code mapping in infrastructure.
 *
 * Symmetric sister of PrismaReceivablesContactLedgerAdapter — single batched
 * findMany with org+JE-id narrowing.
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
