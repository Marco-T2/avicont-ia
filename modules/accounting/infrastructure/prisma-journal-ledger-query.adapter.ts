import { JournalRepository } from "./prisma-journal-entries.repo";
import type {
  ContactLedgerPageResult,
  JournalLedgerQueryPort,
  LedgerAggregateRow,
  LedgerLineRow,
  LedgerPageResult,
} from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  CorrelationAuditFilters,
  CorrelationAuditResult,
  JournalEntryWithLines,
  JournalFilters,
} from "@/modules/accounting/presentation/dto/journal.types";
import type { DateRangeFilter } from "@/modules/accounting/presentation/dto/ledger.types";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

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

  findPaginated(
    organizationId: string,
    filters?: JournalFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JournalEntryWithLines>> {
    return journalRepo.findPaginated(organizationId, filters, pagination);
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

  /** Pass-through. Split-port 3-touchpoint cascade 2nd evidence. */
  findLinesByAccountPaginated(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
    pagination?: PaginationOptions,
  ): Promise<LedgerPageResult> {
    return journalRepo.findLinesByAccountPaginated(
      organizationId,
      accountId,
      filters,
      pagination,
    );
  }

  aggregateByAccount(
    organizationId: string,
    accountId: string,
    periodId: string,
  ): Promise<LedgerAggregateRow> {
    return journalRepo.aggregateByAccount(organizationId, accountId, periodId);
  }

  // ── Contact-keyed reads (C2 GREEN — pass-through al hex repo) ──

  /** Pass-through. Mirror del sister `findLinesByAccountPaginated`. Adapter
   *  SQL-puro; DEC-1 boundary aplica al repo (debit/credit/openingBalanceDelta
   *  retornan strings). */
  findLinesByContactPaginated(
    organizationId: string,
    contactId: string,
    filters?: Parameters<JournalLedgerQueryPort["findLinesByContactPaginated"]>[2],
    pagination?: Parameters<JournalLedgerQueryPort["findLinesByContactPaginated"]>[3],
  ): Promise<ContactLedgerPageResult> {
    return journalRepo.findLinesByContactPaginated(
      organizationId,
      contactId,
      filters,
      pagination,
    );
  }

  /** Pass-through. Scalar string per DEC-1 boundary. BF1 — `accountCodes`
   *  mirror semantics keep the opening balance consistent with the page rows. */
  findOpeningBalanceByContact(
    organizationId: string,
    contactId: string,
    dateFrom: Date,
    accountCodes?: string[],
  ): Promise<unknown> {
    return journalRepo.findOpeningBalanceByContact(
      organizationId,
      contactId,
      dateFrom,
      accountCodes,
    );
  }

  /** Pass-through. Mirror del sister `aggregateByAccount`. DEC-1 strings en
   *  `_sum.{debit,credit}`. BF1 — accountCodes mirror semantics applied here
   *  para que el dashboard saldo abierto coincida con el libro mayor. */
  aggregateOpenBalanceByContact(
    organizationId: string,
    contactId: string,
    accountCodes?: string[],
  ): Promise<LedgerAggregateRow> {
    return journalRepo.aggregateOpenBalanceByContact(
      organizationId,
      contactId,
      accountCodes,
    );
  }
}
