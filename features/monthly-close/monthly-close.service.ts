import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  ConflictError,
  ValidationError,
  PERIOD_ALREADY_CLOSED,
  PERIOD_HAS_DRAFT_ENTRIES,
  PERIOD_UNBALANCED,
} from "@/features/shared/errors";
import { setAuditContext } from "@/features/shared/audit-context";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { MonthlyCloseRepository } from "./monthly-close.repository";
import type {
  CloseRequest,
  CloseResult,
  MonthlyCloseSummary,
} from "./monthly-close.types";

export class MonthlyCloseService {
  private readonly repo: MonthlyCloseRepository;
  private readonly periodsService: FiscalPeriodsService;

  constructor(
    repo?: MonthlyCloseRepository,
    periodsService?: FiscalPeriodsService,
  ) {
    this.repo = repo ?? new MonthlyCloseRepository();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
  }

  // ── Validación compartida: ¿puede cerrarse el período? ──
  //
  // Shared Single Source of Truth (REQ-5 / Design B3) for "does this period
  // have any DRAFT documents that block close?". Consumed by both `close()`
  // (as pre-TX guard) and `getSummary()` (to populate the `drafts` subobject
  // and expose `canClose` to UI pre-flight consumers).
  //
  // PUBLIC on purpose: multiple legitimate call sites today, plus potential
  // UI pre-flight hooks tomorrow (e.g. disable Close button when
  // `canClose === false`). A private SOT would force cast-laden escape hatches
  // in unit tests and future UI code — making it public is the honest shape.
  public async validateCanClose(
    organizationId: string,
    periodId: string,
  ): Promise<{
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
    total: number;
    canClose: boolean;
  }> {
    const drafts = await this.repo.countDraftDocuments(organizationId, periodId);
    const total =
      drafts.dispatches +
      drafts.payments +
      drafts.journalEntries +
      drafts.sales +
      drafts.purchases;
    return {
      ...drafts,
      total,
      canClose: total === 0,
    };
  }

  // ── Resumen previo al cierre ──

  async getSummary(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseSummary> {
    const period = await this.periodsService.getById(organizationId, periodId);

    const [
      postedDispatches,
      postedPayments,
      postedJournalEntries,
      draftsResult,
      journalsByVoucherType,
      rawBalance,
    ] = await Promise.all([
      this.repo.countByStatus(organizationId, periodId, "dispatch", "POSTED"),
      this.repo.countByStatus(organizationId, periodId, "payment", "POSTED"),
      this.repo.countByStatus(organizationId, periodId, "journalEntry", "POSTED"),
      // Shared merge point — same source as `close()` pre-TX guard (REQ-5).
      // `draftsResult` also exposes `total` and `canClose` which are dropped
      // here but available to future UI pre-flight consumers via
      // `validateCanClose()` directly.
      this.validateCanClose(organizationId, periodId),
      this.repo.getJournalSummaryByVoucherType(organizationId, periodId),
      this.repo.sumDebitCreditNoTx(organizationId, periodId),
    ]);

    return {
      periodId: period.id,
      periodStatus: period.status,
      posted: {
        dispatches: postedDispatches,
        payments: postedPayments,
        journalEntries: postedJournalEntries,
      },
      drafts: {
        dispatches: draftsResult.dispatches,
        payments: draftsResult.payments,
        journalEntries: draftsResult.journalEntries,
        sales: draftsResult.sales,
        purchases: draftsResult.purchases,
      },
      journalsByVoucherType,
      balance: {
        balanced: rawBalance.debit.eq(rawBalance.credit),
        totalDebit: rawBalance.debit.toFixed(2),
        totalCredit: rawBalance.credit.toFixed(2),
        difference: rawBalance.debit.minus(rawBalance.credit).abs().toFixed(2),
      },
    };
  }

  // ── Ejecutar cierre mensual ──
  //
  // Flow (see openspec/changes/cierre-periodo/design.md §"Flow"):
  //   1. Generate correlationId (BEFORE entering the transaction) so it can
  //      propagate to every audit_logs row emitted by this close.
  //   2. Resolve the period; throw NotFoundError(PERIOD_NOT_FOUND) on miss.
  //   3. Reject 409 ConflictError(PERIOD_ALREADY_CLOSED) if already closed.
  //   4. Reject 422 ValidationError(PERIOD_HAS_DRAFT_ENTRIES) with per-entity
  //      counts if any DRAFT documents remain.
  //   5. Inside the TX (first statement: setAuditContext with correlationId so
  //      the audit triggers persist it), verify DEBE = HABER via Decimal.eq.
  //   6. Lock in a strict order — Dispatch → Payment → JournalEntry → Sale →
  //      Purchase — then markPeriodClosed LAST. Any throw rolls back the whole
  //      transaction atomically.
  async close(input: CloseRequest): Promise<CloseResult> {
    const { organizationId, periodId, userId, justification } = input;

    // 1. correlationId BEFORE the TX.
    const correlationId = crypto.randomUUID();

    // 2. Period must exist.
    const period = await this.periodsService.getById(organizationId, periodId);

    // 3. Already closed → 409.
    if (period.status === "CLOSED") {
      throw new ConflictError(
        "El período fiscal",
        PERIOD_ALREADY_CLOSED,
      );
    }

    // 4. No drafts allowed → 422 with per-entity counts. Source of truth is
    //    `validateCanClose()` so `close()` and `getSummary()` surface the same
    //    5-key shape (REQ-5 / Design B3).
    const drafts = await this.validateCanClose(organizationId, periodId);

    if (!drafts.canClose) {
      const parts: string[] = [];
      if (drafts.dispatches > 0) parts.push(`${drafts.dispatches} despacho(s)`);
      if (drafts.payments > 0) parts.push(`${drafts.payments} pago(s)`);
      if (drafts.journalEntries > 0)
        parts.push(`${drafts.journalEntries} asiento(s) de diario`);
      if (drafts.sales > 0) parts.push(`${drafts.sales} venta(s)`);
      if (drafts.purchases > 0) parts.push(`${drafts.purchases} compra(s)`);

      throw new ValidationError(
        `El periodo tiene registros en borrador: ${parts.join(", ")}. Debe publicarlos o eliminarlos antes de cerrar`,
        PERIOD_HAS_DRAFT_ENTRIES,
        {
          dispatches: drafts.dispatches,
          payments: drafts.payments,
          journalEntries: drafts.journalEntries,
          sales: drafts.sales,
          purchases: drafts.purchases,
        },
      );
    }

    // 5 + 6. Atomic TX: audit context → balance check → lock cascade → close.
    return this.repo.transaction(
      async (tx) => {
        // MUST be the first statement inside the TX so the trigger picks up
        // the correlation_id on every mutation that follows.
        await setAuditContext(tx, userId, justification, correlationId);

        const balance = await this.repo.sumDebitCredit(
          tx,
          organizationId,
          periodId,
        );

        if (!balance.debit.eq(balance.credit)) {
          const diff = balance.debit.minus(balance.credit).abs();
          throw new ValidationError(
            `El período no balancea: DEBE = ${balance.debit.toFixed(2)} / HABER = ${balance.credit.toFixed(2)} (diferencia ${diff.toFixed(2)})`,
            PERIOD_UNBALANCED,
            {
              debit: balance.debit,
              credit: balance.credit,
              diff,
            },
          );
        }

        // Lock cascade — STRICT ORDER (see design §"Lock order").
        const dispatches = await this.repo.lockDispatches(tx, organizationId, periodId);
        const payments = await this.repo.lockPayments(tx, organizationId, periodId);
        const journalEntries = await this.repo.lockJournalEntries(tx, organizationId, periodId);
        const sales = await this.repo.lockSales(tx, organizationId, periodId);
        const purchases = await this.repo.lockPurchases(tx, organizationId, periodId);

        // markPeriodClosed is LAST inside the TX.
        const { closedAt } = await this.repo.markPeriodClosed(
          tx,
          organizationId,
          periodId,
          userId,
        );

        return {
          periodId,
          periodStatus: "CLOSED" as const,
          closedAt,
          correlationId,
          locked: { dispatches, payments, journalEntries, sales, purchases },
        };
      },
      { timeout: 30_000 },
    );
  }
}

// Keep the Prisma import hooked even if unused here — future typings may
// reference Prisma.Decimal directly in this module.
void Prisma;
