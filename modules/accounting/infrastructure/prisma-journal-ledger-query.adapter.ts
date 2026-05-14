import { JournalRepository } from "./prisma-journal-entries.repo";
import type {
  JournalLedgerQueryPort,
  LedgerAggregateRow,
  LedgerLineRow,
} from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  CorrelationAuditFilters,
  CorrelationAuditResult,
  JournalEntryWithLines,
  JournalFilters,
} from "@/modules/accounting/presentation/dto/journal.types";
import type { DateRangeFilter } from "@/modules/accounting/presentation/dto/ledger.types";

/**
 * Tx-less Prisma adapter for `JournalLedgerQueryPort` (POC #7 OLEADA 6 — C1).
 *
 * Delegates the 5 journal reads + 2 libro-mayor reads to the hex
 * `JournalRepository` (folded into `prisma-journal-entries.repo.ts` at C0).
 * Pure pass-through — every method is a thin delegation; no transformation,
 * no money math (DEV-1 / R-money: the float `Number()` accumulation lives in
 * `LedgerService`, this adapter just returns the raw rows).
 *
 * Constructor sin args, hex repo singleton module-scope — parity with
 * `PrismaJournalEntriesReadAdapter` (the repo is state-less, extends
 * `BaseRepository` with the default `prisma` client).
 */

const journalRepo = new JournalRepository();

export class PrismaJournalLedgerQueryAdapter implements JournalLedgerQueryPort {
  list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return journalRepo.findAll(organizationId, filters);
  }

  findById(
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines | null> {
    return journalRepo.findById(organizationId, id);
  }

  getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null> {
    return journalRepo.getLastReferenceNumber(organizationId, voucherTypeId);
  }

  getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number> {
    return journalRepo.getNextNumber(organizationId, voucherTypeId, periodId);
  }

  findForCorrelationAudit(
    organizationId: string,
    voucherTypeId: string,
    filters?: Pick<CorrelationAuditFilters, "dateFrom" | "dateTo">,
  ): Promise<{
    withReference: CorrelationAuditResult["entries"];
    withoutReferenceCount: number;
  }> {
    return journalRepo.findForCorrelationAudit(
      organizationId,
      voucherTypeId,
      filters,
    );
  }

  findLinesByAccount(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
  ): Promise<LedgerLineRow[]> {
    return journalRepo.findLinesByAccount(organizationId, accountId, filters);
  }

  aggregateByAccount(
    organizationId: string,
    accountId: string,
    periodId: string,
  ): Promise<LedgerAggregateRow> {
    return journalRepo.aggregateByAccount(organizationId, accountId, periodId);
  }
}
