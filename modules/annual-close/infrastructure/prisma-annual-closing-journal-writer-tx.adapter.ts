import { Prisma } from "@/generated/prisma/client";

import { NotFoundError } from "@/modules/shared/domain/errors";

import { PeriodAlreadyClosedError } from "../domain/errors/annual-close-errors";
import type {
  AnnualClosingEntryInput,
  AnnualClosingEntryResult,
  AnnualClosingJournalWriterTxPort,
} from "../domain/ports/annual-closing-journal-writer-tx.port";

/**
 * Postgres-backed INSIDE-TX writer for `AnnualClosingJournalWriterTxPort`
 * (design rev 2 §4 + §5, Phase 4.10 GREEN).
 *
 * Tx-bound at construction. Inserts the CC + CA vouchers POSTED directly
 * (no DRAFT lifecycle — annual-close arrives with pre-computed Decimal lines).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **REQ-2.7 / C-5 invariant** — port-level period-status guard.
 *
 * The annual-close writer bypasses `JournalsService.validateAndCreateDraft`
 * which classically enforces "no JE into CLOSED period". Therefore the
 * adapter MUST, INSIDE the same TX and BEFORE inserting, re-read the target
 * `FiscalPeriod` and assert `status === 'OPEN'`. Not OPEN → throw
 * `PeriodAlreadyClosedError`; period missing → `NotFoundError`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **W-1 — Voucher correlative race-safety**.
 *
 * Delegates voucher-`number` resolution + INSERT + `accountBalances.applyPost`
 * (POSTED status) to `JournalRepository.createWithRetryTx` at
 * `modules/accounting/infrastructure/prisma-journal-entries.repo.ts:268`.
 * Inline `MAX(number)+1` is FORBIDDEN — proven race-unsafe (REQ-B.2,
 * `get-next-number-concurrency.test.ts`).
 *
 * The factory pattern (constructor 2nd arg) keeps the adapter testable
 * without instantiating the full `JournalRepository` (cross-module
 * import that depends on the broader accounting module). Composition
 * root passes `(tx) => new JournalRepository(tx)`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **DEC-1 boundary**. The adapter is the ONLY place `decimal.js Decimal` is
 * converted into `Prisma.Decimal`: `new Prisma.Decimal(d.toString())`.
 * Domain and application layers stay `decimal.js`-pure.
 *
 * The `sourceType` + `sourceId` linkage (annual-close + FY id) is written
 * post-INSERT via a same-TX `journalEntry.update` because the
 * `JournalRepository.createWithRetryTx` signature already accepts both
 * fields via its `data` argument — handled inline below.
 */

interface JournalRepositoryLike {
  createWithRetryTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: {
      voucherTypeId: string;
      periodId: string;
      date: Date;
      description: string;
      createdById: string;
      sourceType?: string;
      sourceId?: string;
    },
    lines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      description?: string | null;
      order?: number;
    }>,
    status: "DRAFT" | "POSTED",
  ): Promise<{ id: string }>;
}

export type JournalRepositoryFactory = (
  tx: Prisma.TransactionClient,
) => JournalRepositoryLike;

export class PrismaAnnualClosingJournalWriterTxAdapter
  implements AnnualClosingJournalWriterTxPort
{
  constructor(
    private readonly tx: Pick<
      Prisma.TransactionClient,
      "fiscalPeriod" | "voucherTypeCfg" | "journalEntry"
    >,
    private readonly repoFactory: JournalRepositoryFactory,
  ) {}

  async createAndPost(
    input: AnnualClosingEntryInput,
  ): Promise<AnnualClosingEntryResult> {
    // ── REQ-2.7 / C-5 — period-status invariant ──────────────────────────
    const period = await this.tx.fiscalPeriod.findUnique({
      where: { id: input.periodId },
      select: { status: true },
    });
    if (!period) {
      throw new NotFoundError(`El período ${input.periodId}`, "PERIOD_NOT_FOUND");
    }
    if (period.status !== "OPEN") {
      throw new PeriodAlreadyClosedError({
        periodId: input.periodId,
        status: period.status,
      });
    }

    // ── Resolve voucher type by (orgId, code) ────────────────────────────
    const voucherType = await this.tx.voucherTypeCfg.findUniqueOrThrow({
      where: {
        organizationId_code: {
          organizationId: input.organizationId,
          code: input.voucherTypeCode,
        },
      },
    });

    // ── W-1 — delegate to createWithRetryTx (race-safe correlative) ──────
    const repo = this.repoFactory(
      this.tx as unknown as Prisma.TransactionClient,
    );
    const created = await repo.createWithRetryTx(
      this.tx as unknown as Prisma.TransactionClient,
      input.organizationId,
      {
        voucherTypeId: voucherType.id,
        periodId: input.periodId,
        date: input.date,
        description: input.description,
        createdById: input.createdById,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      input.lines.map((l, idx) => ({
        accountId: l.accountId,
        // DEC-1 boundary — decimal.js → Prisma.Decimal via toString.
        debit: new Prisma.Decimal(l.debit.toString()),
        credit: new Prisma.Decimal(l.credit.toString()),
        description: l.description ?? null,
        order: idx,
      })),
      "POSTED",
    );

    return { entryId: created.id };
  }
}
