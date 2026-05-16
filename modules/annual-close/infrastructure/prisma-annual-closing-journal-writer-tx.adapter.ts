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
 * **DEC-1 boundary — signature drift honest surface** per [[shim_retirement_signature_drift]]:
 *
 * Design rev 2 §5 sketched `lines[].debit: new Prisma.Decimal(d.toString())`.
 * The real `JournalRepository.createWithRetryTx` signature consumes
 * `JournalLineInput[]` (canonical at `modules/accounting/presentation/dto/
 * journal.types.ts:13`) where `debit: number, credit: number`. Prisma's
 * Decimal column coerces from `number | string | Decimal` at the driver
 * boundary, so passing numbers works at runtime — but the existing legacy
 * type drives the static contract.
 *
 * The DEC-1 boundary in this adapter therefore uses `Decimal.toNumber()`
 * (NOT `new Prisma.Decimal(d.toString())`). Annual-close values come from
 * `::numeric(18,2)` aggregations bounded < 1e10 BOB (Bolivian SME max
 * realistic) — well within `Number.MAX_SAFE_INTEGER` (~9e15). Zero
 * precision loss for any realistic ledger; the bit-perfect balance gate
 * already ran via `Decimal.equals` in the cc/ca-line builders BEFORE
 * the .toNumber() conversion here. Diverging from design rev 2 §5 — revisit
 * if `JournalRepository.createWithRetryTx` evolves to accept `Decimal`
 * inputs directly.
 *
 * The `sourceType` + `sourceId` linkage (annual-close + FY id) is passed
 * inline via the `data` arg — `createWithRetryTx` persists both fields.
 */

interface JournalLineInputLike {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
  order: number;
}

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
    lines: JournalLineInputLike[],
    status?: "DRAFT" | "POSTED",
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
        // DEC-1 boundary — decimal.js → number (bounded < 1e10 BOB, no
        // precision loss; signature drift cited in file-level JSDoc).
        debit: l.debit.toNumber(),
        credit: l.credit.toNumber(),
        description: l.description,
        order: idx,
      })),
      "POSTED",
    );

    return { entryId: created.id };
  }
}
