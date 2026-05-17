import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  PayableLedgerEnrichmentRow,
  PayablesContactLedgerPort,
} from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";
import { purchaseTypeToCode } from "@/modules/accounting/shared/infrastructure/document-type-codes";

/**
 * Prisma adapter for the contact-ledger payable enrichment lookup.
 *
 * Symmetric sister of `PrismaReceivablesContactLedgerAdapter` — same batched
 * findMany + journalEntryId narrow + minimal projection. See sister adapter
 * JSDoc for the N+1 mitigation rationale.
 *
 * `documentTypeCode` resolution per `sourceType`:
 *   - "purchase" → batched lookup `purchase.findMany({id in sourceIds})` para
 *                  resolver PurchaseType enum → FL|PF|CG|SV.
 *   - "manual"/null → null (UI muestra "Ajuste").
 */
type DbClient = Pick<PrismaClient, "accountsPayable" | "purchase">;

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
        sourceType: true,
        sourceId: true,
      },
    });

    // Batched purchase lookup: misma forma sister Receivable adapter.
    const purchaseIds = rows
      .filter((r) => r.sourceType === "purchase" && r.sourceId)
      .map((r) => r.sourceId!) as string[];
    const purchaseTypeById = new Map<string, string>();
    if (purchaseIds.length > 0) {
      const purchases = await this.db.purchase.findMany({
        where: {
          organizationId,
          id: { in: purchaseIds },
        },
        select: { id: true, purchaseType: true },
      });
      for (const p of purchases) {
        purchaseTypeById.set(p.id, purchaseTypeToCode(p.purchaseType));
      }
    }

    return rows
      .filter((r): r is typeof r & { journalEntryId: string } =>
        r.journalEntryId !== null,
      )
      .map((r) => {
        let documentTypeCode: string | null = null;
        if (r.sourceType === "purchase" && r.sourceId) {
          documentTypeCode = purchaseTypeById.get(r.sourceId) ?? null;
        }
        return {
          journalEntryId: r.journalEntryId,
          status: r.status,
          dueDate: r.dueDate,
          documentTypeCode,
        };
      });
  }
}
