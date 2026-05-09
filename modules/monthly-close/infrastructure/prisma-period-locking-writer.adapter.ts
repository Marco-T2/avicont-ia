import type { Prisma } from "@/generated/prisma/client";
import type { PeriodLockingWriterPort } from "../domain/ports/period-locking-writer.port";

/**
 * Cross-module Prisma direct tx-bound adapter para `PeriodLockingWriterPort` —
 * 5 separate `updateMany {POSTED → LOCKED}` cross-entity INSIDE-TX mirror
 * legacy `features/monthly-close/monthly-close.repository.ts:135-216` shape
 * EXACT 5 methods retornan `result.count` Promise<number> lock count primitive.
 *
 * Tx-bound at construction (mirror `PrismaFiscalPeriodsTxRepo` +
 * `PrismaAccountBalancesRepo` + `PrismaJournalEntriesRepository` precedent
 * 3+ evidencias supersede absoluto): `Prisma.TransactionClient` recibido en
 * constructor, consumer (UoW.run callback) NO ve tx token.
 *
 * **Riesgo C lock cascade rationale — STRICT ORDER preserved at service-level**
 * (port NO impone orden, service-level orchestration responsibility C2.2
 * `modules/monthly-close/application/monthly-close.service.ts:124-129`
 * Dispatch → Payment → JournalEntry → Sale → Purchase secuencial). Rationale
 * FK direction Sale↔JE archive
 * `openspec/changes/archive/2026-04-21-cierre-periodo/design.md` §"Lock order"
 * (frozen logic pre-hex POC nuevo monthly-close). Lock #6 paired adapter +
 * UoW JSDoc cementación 1ra evidencia POC.
 *
 * §17 carve-out: cross-module Prisma access 5 entity tables (`dispatch`,
 * `payment`, `journalEntry`, `sale`, `purchase`) — adapter consume Prisma
 * concretes outside owning modules. Cross-module scope justificado
 * driver-anchored: legacy `MonthlyCloseRepository` ya agregaba 5 lock methods
 * en mismo class boundary; consumer-driven hex monthly-close OWNS
 * `PeriodLockingWriterPort` (port en `domain/`, R3 vigente — flecha apunta
 * dominio).
 *
 * §13 NEW Writer adapter naming `prisma-<X>-writer.adapter.ts` 1ra evidencia
 * POC monthly-close paired sister Reader pattern (Lock #3 NEW canonical home
 * D1 cementación cumulative cross-module).
 */
export class PrismaPeriodLockingWriterAdapter
  implements PeriodLockingWriterPort
{
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async lockDispatches(
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const result = await this.tx.dispatch.updateMany({
      where: { organizationId, periodId, status: "POSTED" },
      data: { status: "LOCKED" },
    });
    return result.count;
  }

  async lockPayments(
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const result = await this.tx.payment.updateMany({
      where: { organizationId, periodId, status: "POSTED" },
      data: { status: "LOCKED" },
    });
    return result.count;
  }

  async lockJournalEntries(
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const result = await this.tx.journalEntry.updateMany({
      where: { organizationId, periodId, status: "POSTED" },
      data: { status: "LOCKED" },
    });
    return result.count;
  }

  async lockSales(organizationId: string, periodId: string): Promise<number> {
    const result = await this.tx.sale.updateMany({
      where: { organizationId, periodId, status: "POSTED" },
      data: { status: "LOCKED" },
    });
    return result.count;
  }

  async lockPurchases(
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const result = await this.tx.purchase.updateMany({
      where: { organizationId, periodId, status: "POSTED" },
      data: { status: "LOCKED" },
    });
    return result.count;
  }
}
