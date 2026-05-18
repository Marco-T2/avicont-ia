import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ReceivableLedgerEnrichmentRow,
  ReceivablesContactLedgerPort,
} from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";

/**
 * Prisma adapter for the contact-ledger receivable enrichment lookup.
 *
 * journal-physical-document Phase 5 simplification: the adapter now only
 * surfaces `status` + `dueDate`. The previous `sale.findMany` + `dispatch.
 * findMany` batched lookups were used to resolve `documentTypeCode` +
 * `documentReferenceNumber`; those fields are now read off the JE row
 * directly in `LedgerService.getContactLedgerPaginated` (denormalized via
 * the Phase 5 `journalIncludeLines` extension). Net effect: 2 fewer DB
 * queries per page (-66% adapter work) and no more enum→code mapping in
 * infrastructure.
 *
 * Single batched `accountsReceivable.findMany` with org+JE-id narrowing —
 * one call per page (N+1 mitigation per design risk #1).
 */
type DbClient = Pick<PrismaClient, "accountsReceivable">;

export class PrismaReceivablesContactLedgerAdapter
  implements ReceivablesContactLedgerPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<ReceivableLedgerEnrichmentRow[]> {
    if (journalEntryIds.length === 0) return [];
    const rows = await this.db.accountsReceivable.findMany({
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
