import type { Prisma } from "@/generated/prisma/client";

import { FiscalYearAlreadyClosedError } from "../domain/errors/annual-close-errors";
import type {
  FiscalYearWriterTxPort,
  MarkClosedInput,
  MarkClosedResult,
  UpsertOpenInput,
  UpsertOpenResult,
} from "../domain/ports/fiscal-year-writer-tx.port";

/**
 * Postgres-backed INSIDE-TX writer adapter for `FiscalYearWriterTxPort`
 * (design rev 2 §5, Phase 4.4 GREEN).
 *
 * Tx-bound at construction — mirror `PrismaPeriodLockingWriterAdapter` +
 * `PrismaFiscalPeriodsTxRepo` precedent EXACT (3+ evidencias supersede
 * absoluto). Consumer (UoW.run callback) never sees the `tx` token.
 *
 * **W-3 — Guarded markClosed** (spec REQ-1.2 + REQ-2.5 + design rev 2 §5):
 * the OPEN → CLOSED transition uses `updateMany({where:{id, status:"OPEN"}})`
 * so the predicate compiles to `UPDATE ... WHERE id = ? AND status = 'OPEN'`.
 * If `count !== 1` the row was already CLOSED by a concurrent annual-close
 * (lost-update race): throw `FiscalYearAlreadyClosedError` and let the TX
 * roll back — no orphan CC/CA vouchers persist.
 *
 * The aggregate-level guard in `FiscalYear.markClosed` only catches
 * in-process double-calls; this DB-level predicate catches concurrent TXs.
 *
 * `upsertOpen` uses Prisma `upsert` against `@@unique([organizationId, year])`;
 * `update: {}` means a pre-existing row is returned unchanged (idempotent).
 * Safe to retry — spec REQ-2.5 + design rev 2 §4 step (a').
 */
export class PrismaFiscalYearWriterTxAdapter implements FiscalYearWriterTxPort {
  constructor(private readonly tx: Pick<Prisma.TransactionClient, "fiscalYear">) {}

  async upsertOpen(input: UpsertOpenInput): Promise<UpsertOpenResult> {
    const row = await this.tx.fiscalYear.upsert({
      where: {
        organizationId_year: {
          organizationId: input.organizationId,
          year: input.year,
        },
      },
      create: {
        organizationId: input.organizationId,
        year: input.year,
        status: "OPEN",
        createdById: input.createdById,
      },
      update: {},
      select: { id: true },
    });
    return { id: row.id };
  }

  async markClosed(input: MarkClosedInput): Promise<MarkClosedResult> {
    const closedAt = new Date();
    // W-3 guarded UPDATE — compiles to WHERE id = ? AND status = 'OPEN'.
    const result = await this.tx.fiscalYear.updateMany({
      where: { id: input.fiscalYearId, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedAt,
        closedBy: input.closedBy,
        closingEntryId: input.closingEntryId,
        openingEntryId: input.openingEntryId,
      },
    });
    if (result.count !== 1) {
      throw new FiscalYearAlreadyClosedError({
        fiscalYearId: input.fiscalYearId,
      });
    }
    return { closedAt };
  }
}
