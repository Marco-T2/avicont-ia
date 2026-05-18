import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  PaymentLedgerEnrichmentRow,
  PaymentsContactLedgerPort,
} from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";

/**
 * Prisma adapter for the contact-ledger payment enrichment lookup.
 *
 * journal-physical-document Phase 5 simplification: `operationalDocType` +
 * `referenceNumber` removed from the select — the ledger service reads them
 * directly off the JE row now. Live state still surfaced: `paymentMethod`
 * (forma de pago suffix), `bankAccountName` (BNB/etc), `direction`
 * (COBRO|PAGO drives the "Cobranza" vs "Pago" human label per BF2).
 *
 * Batched `payment.findMany` + minimal include of the FIRST allocation
 * (id asc) to derive `direction` (COBRO when the first allocation targets a
 * receivable, PAGO when payable). Payment-allocation invariants guarantee
 * homogeneous direction per payment so one allocation suffices.
 */
type DbClient = Pick<PrismaClient, "payment">;

export class PrismaPaymentsContactLedgerAdapter
  implements PaymentsContactLedgerPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<PaymentLedgerEnrichmentRow[]> {
    if (journalEntryIds.length === 0) return [];
    const rows = await this.db.payment.findMany({
      where: {
        organizationId,
        journalEntryId: { in: journalEntryIds },
      },
      select: {
        journalEntryId: true,
        method: true,
        accountCode: true,
        allocations: {
          orderBy: { id: "asc" },
          take: 1,
          select: {
            receivableId: true,
            payableId: true,
          },
        },
      },
    });
    return rows
      .filter((r): r is typeof r & { journalEntryId: string } =>
        r.journalEntryId !== null,
      )
      .map((r) => {
        const first = r.allocations[0];
        const direction = first
          ? first.receivableId !== null
            ? "COBRO"
            : "PAGO"
          : "COBRO"; // no allocations → safe default; UI rarely renders direction
                    // in this case (payment-only rows show forma de pago suffix only).
        return {
          journalEntryId: r.journalEntryId,
          paymentMethod: r.method,
          bankAccountName: r.accountCode,
          direction,
        };
      });
  }
}
