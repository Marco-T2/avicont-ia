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
 * Delegates to a single batched `accountsReceivable.findMany({ where: {
 * organizationId, journalEntryId: { in: ids } } })` — the service collects
 * journalEntryIds dedup'd per page (N+1 mitigation per design risk #1).
 *
 * Returns ONLY the minimum fields the service needs to derive `status`
 * (PENDING/PARTIAL/PAID/VOIDED) + ATRASADO from `dueDate < now` — does NOT
 * leak Prisma.Decimal or unrelated columns into the enrichment row shape
 * (port projection per `ReceivableLedgerEnrichmentRow`).
 *
 * Wired at composition root (C4) into `LedgerService.contactLedgerDeps`.
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
    // journalEntryId is nullable on the model; filter rows that have one
    // (the in-clause guarantees this in practice, but the type narrows
    // explicitly to satisfy the port projection).
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
