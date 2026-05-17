import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ReceivableLedgerEnrichmentRow,
  ReceivablesContactLedgerPort,
} from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";
import {
  SALE_DOCUMENT_TYPE_CODE,
  dispatchTypeToCode,
  formatDocumentReferenceNumber,
} from "@/modules/accounting/shared/infrastructure/document-type-codes";

/**
 * Prisma adapter for the contact-ledger receivable enrichment lookup.
 *
 * Delegates to a single batched `accountsReceivable.findMany({ where: {
 * organizationId, journalEntryId: { in: ids } } })` — the service collects
 * journalEntryIds dedup'd per page (N+1 mitigation per design risk #1).
 *
 * `documentTypeCode` resolution per `sourceType`:
 *   - "sale"     → "VG" hardcoded (Sale no tiene operationalDocType configurable).
 *   - "dispatch" → batched lookup `dispatch.findMany({id in sourceIds})` para
 *                  resolver DispatchType enum → ND|BC. Una sola query
 *                  adicional por página, sólo cuando hay dispatch rows.
 *   - "manual"/null → null (UI muestra "Ajuste" via withoutAuxiliary flag).
 *
 * Wired at composition root (C4) into `LedgerService.contactLedgerDeps`.
 */
type DbClient = Pick<PrismaClient, "accountsReceivable" | "dispatch" | "sale">;

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
        sourceType: true,
        sourceId: true,
      },
    });

    // Batched dispatch lookup: agrupo sourceIds de las receivables con
    // sourceType="dispatch" y hago UNA query para resolver el DispatchType
    // enum + sequenceNumber (DT4 — el número físico del documento). N+1
    // mitigation: máximo 1 query adicional por página.
    const dispatchIds = rows
      .filter((r) => r.sourceType === "dispatch" && r.sourceId)
      .map((r) => r.sourceId!) as string[];
    const dispatchTypeById = new Map<string, string>();
    const dispatchSequenceById = new Map<string, number>();
    if (dispatchIds.length > 0) {
      const dispatches = await this.db.dispatch.findMany({
        where: {
          organizationId,
          id: { in: dispatchIds },
        },
        select: { id: true, dispatchType: true, sequenceNumber: true },
      });
      for (const d of dispatches) {
        dispatchTypeById.set(d.id, dispatchTypeToCode(d.dispatchType));
        dispatchSequenceById.set(d.id, d.sequenceNumber);
      }
    }

    // Batched sale lookup (DT4): resolve `sequenceNumber` para sourceType="sale".
    // El code es fijo "VG" — sólo necesitamos el sequence para formatear.
    const saleIds = rows
      .filter((r) => r.sourceType === "sale" && r.sourceId)
      .map((r) => r.sourceId!) as string[];
    const saleSequenceById = new Map<string, number>();
    if (saleIds.length > 0) {
      const sales = await this.db.sale.findMany({
        where: {
          organizationId,
          id: { in: saleIds },
        },
        select: { id: true, sequenceNumber: true },
      });
      for (const s of sales) {
        saleSequenceById.set(s.id, s.sequenceNumber);
      }
    }

    // journalEntryId is nullable on the model; filter rows that have one
    // (the in-clause guarantees this in practice, but the type narrows
    // explicitly to satisfy the port projection).
    return rows
      .filter((r): r is typeof r & { journalEntryId: string } =>
        r.journalEntryId !== null,
      )
      .map((r) => {
        let documentTypeCode: string | null = null;
        let sequence: number | null = null;
        if (r.sourceType === "sale") {
          documentTypeCode = SALE_DOCUMENT_TYPE_CODE;
          sequence = r.sourceId ? saleSequenceById.get(r.sourceId) ?? null : null;
        } else if (r.sourceType === "dispatch" && r.sourceId) {
          documentTypeCode = dispatchTypeById.get(r.sourceId) ?? null;
          sequence = dispatchSequenceById.get(r.sourceId) ?? null;
        }
        return {
          journalEntryId: r.journalEntryId,
          status: r.status,
          dueDate: r.dueDate,
          documentTypeCode,
          documentReferenceNumber: formatDocumentReferenceNumber(
            documentTypeCode,
            sequence,
          ),
        };
      });
  }
}
