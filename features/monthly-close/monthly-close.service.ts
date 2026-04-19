import "server-only";
import {
  ValidationError,
  PERIOD_HAS_DRAFT_ENTRIES,
  PERIOD_ALREADY_CLOSED,
} from "@/features/shared/errors";
import { setAuditContext } from "@/features/shared/audit-context";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { MonthlyCloseRepository } from "./monthly-close.repository";
import type { MonthlyCloseSummary, CloseResult } from "./monthly-close.types";

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
      draftDispatches,
      draftPayments,
      draftJournalEntries,
      journalsByVoucherType,
    ] = await Promise.all([
      this.repo.countByStatus(organizationId, periodId, "dispatch", "POSTED"),
      this.repo.countByStatus(organizationId, periodId, "payment", "POSTED"),
      this.repo.countByStatus(organizationId, periodId, "journalEntry", "POSTED"),
      this.repo.countByStatus(organizationId, periodId, "dispatch", "DRAFT"),
      this.repo.countByStatus(organizationId, periodId, "payment", "DRAFT"),
      this.repo.countByStatus(organizationId, periodId, "journalEntry", "DRAFT"),
      this.repo.getJournalSummaryByVoucherType(organizationId, periodId),
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
        dispatches: draftDispatches,
        payments: draftPayments,
        journalEntries: draftJournalEntries,
      },
      journalsByVoucherType,
    };
  }

  // ── Ejecutar cierre mensual ──

  async close(
    organizationId: string,
    periodId: string,
    userId: string,
  ): Promise<CloseResult> {
    const period = await this.periodsService.getById(organizationId, periodId);

    if (period.status === "CLOSED") {
      throw new ValidationError(
        "El periodo ya esta cerrado",
        PERIOD_ALREADY_CLOSED,
      );
    }

    // Verificar registros en DRAFT antes de intentar el cierre
    const [draftDispatches, draftPayments, draftJournalEntries] =
      await Promise.all([
        this.repo.countByStatus(organizationId, periodId, "dispatch", "DRAFT"),
        this.repo.countByStatus(organizationId, periodId, "payment", "DRAFT"),
        this.repo.countByStatus(organizationId, periodId, "journalEntry", "DRAFT"),
      ]);

    const totalDrafts = draftDispatches + draftPayments + draftJournalEntries;

    if (totalDrafts > 0) {
      const parts: string[] = [];
      if (draftDispatches > 0) parts.push(`${draftDispatches} despacho(s)`);
      if (draftPayments > 0) parts.push(`${draftPayments} pago(s)`);
      if (draftJournalEntries > 0) parts.push(`${draftJournalEntries} asiento(s)`);

      throw new ValidationError(
        `El periodo tiene registros en borrador: ${parts.join(", ")}. Debe publicarlos o eliminarlos antes de cerrar`,
        PERIOD_HAS_DRAFT_ENTRIES,
      );
    }

    // Transacción atómica única: contexto de auditoría -> bloquear todo -> cerrar período
    return this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      const dispatches = await this.repo.lockDispatches(tx, organizationId, periodId);
      const payments = await this.repo.lockPayments(tx, organizationId, periodId);
      const journalEntries = await this.repo.lockJournalEntries(tx, organizationId, periodId);
      await this.repo.closePeriod(tx, organizationId, periodId);

      return { dispatches, payments, journalEntries, periodStatus: "CLOSED" };
    });
  }
}
