import type { PrismaClient } from "@/generated/prisma/client";
import type {
  DraftDocumentsReaderPort,
  MonthlyCloseDraftCounts,
} from "../domain/ports/draft-documents-reader.port";

/**
 * Cross-module Prisma direct adapter para `DraftDocumentsReaderPort` —
 * 5 entities `Promise.all` count cross-entity outside-scope read-only pre-TX
 * guard `validateCanClose` mirror legacy
 * `features/monthly-close/monthly-close.repository.ts:57-89` shape EXACT
 * `{dispatches, payments, journalEntries, sales, purchases: number}`.
 *
 * §17 carve-out: cross-module Prisma access 5 entity tables (`dispatch`,
 * `payment`, `journalEntry`, `sale`, `purchase`) — adapter consume Prisma
 * concretes outside accounting/iva-books/sale/purchase modules. Cross-module
 * scope justificado driver-anchored: legacy `MonthlyCloseRepository` ya
 * agregaba 5 entity counts en mismo class boundary (single concern: draft
 * counts), y consumer-driven hex monthly-close OWNS `DraftDocumentsReaderPort`
 * (port en `domain/`, R3 vigente — flecha apunta dominio).
 */
export class PrismaDraftDocumentsReaderAdapter
  implements DraftDocumentsReaderPort
{
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "dispatch" | "payment" | "journalEntry" | "sale" | "purchase"
    >,
  ) {}

  async countDraftsByPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseDraftCounts> {
    const [dispatches, payments, journalEntries, sales, purchases] =
      await Promise.all([
        this.db.dispatch.count({
          where: { organizationId, periodId, status: "DRAFT" },
        }),
        this.db.payment.count({
          where: { organizationId, periodId, status: "DRAFT" },
        }),
        this.db.journalEntry.count({
          where: { organizationId, periodId, status: "DRAFT" },
        }),
        this.db.sale.count({
          where: { organizationId, periodId, status: "DRAFT" },
        }),
        this.db.purchase.count({
          where: { organizationId, periodId, status: "DRAFT" },
        }),
      ]);

    return { dispatches, payments, journalEntries, sales, purchases };
  }
}
