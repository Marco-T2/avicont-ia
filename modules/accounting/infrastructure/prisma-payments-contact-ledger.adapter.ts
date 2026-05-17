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
 * Batched `payment.findMany({ where: { organizationId, journalEntryId: { in } } })`
 * + minimal include of the FIRST allocation (id asc) to derive `direction`
 * (COBRO when first allocation targets a receivable, PAGO when payable).
 * `bankAccountName` is the Payment.accountCode string scalar — schema reality:
 * the Payment model carries `accountCode` directly (no BankAccount FK), so
 * the human "BNB Cta Cte" the spec mentions surfaces as `accountCode` here.
 *
 * `documentTypeCode` resuelve desde la relación opcional `operationalDocType`
 * (Payment.operationalDocTypeId → OperationalDocType.code, ej. "RC"/"RE"/"RI").
 * Null cuando el Payment no tiene operationalDocType asignado (org sin
 * configuración o payments legacy) — la UI cae al label genérico.
 *
 * Service-side merge maps `(method, direction, bankAccountName)` to UI labels
 * — adapter stays pure SQL + projection (DEC-1 / D3 parity).
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
        operationalDocType: { select: { code: true } },
        // First allocation reveals direction (RECEIVABLE → COBRO, PAYABLE → PAGO);
        // payment-allocation invariants guarantee homogeneous direction per
        // payment (PAYMENT_MIXED_ALLOCATION), so any one allocation suffices.
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
          documentTypeCode: r.operationalDocType?.code ?? null,
        };
      });
  }
}
