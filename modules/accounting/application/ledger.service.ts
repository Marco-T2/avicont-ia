import { NotFoundError } from "@/features/shared/errors";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import type { JournalLedgerQueryPort } from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  DateRangeFilter,
  LedgerEntry,
  LedgerPaginatedDto,
  TrialBalanceRow,
} from "@/modules/accounting/presentation/dto/ledger.types";
import {
  roundHalfUp,
  sumDecimals,
} from "@/modules/accounting/shared/domain/money.utils";
import type { PaginationOptions } from "@/modules/shared/domain/value-objects/pagination";
import type { AccountType } from "@/generated/prisma/client";
import Decimal from "decimal.js";

/**
 * Application-layer libro-mayor use cases.
 *
 * Migrated from legacy `features/accounting/ledger.service.ts` (POC #7 OLEADA 6 — C1);
 * shim retired at OLEADA 6 sub-POC 8/8.
 *
 * Port-driven: reaches journal-line data through `JournalLedgerQueryPort`
 * (not the Prisma repo directly), accounts through `AccountsCrudPort`, and
 * period balances through `AccountBalancesService`.
 *
 * Decimal-converged per poc-money-math-decimal-convergence (OLEADA 7 POC #2):
 * running-balance accumulation and trial-balance totals use `decimal.js`
 * `Decimal` (`sumDecimals` + `.minus()` chain) from `shared/domain/money.utils`,
 * with `roundHalfUp(...).toFixed(2)` serializing monetary fields as `string`
 * at the DTO boundary. R-money textual deviation DISCHARGED. Direct
 * `decimal.js` consumption per oleada-money-decimal-hex-purity sub-POC 4
 * (sister precedents: sub-POC 2 FS/TB/ES/WS/IB builders + sub-POC 3 sale/
 * purchase/dispatch/ai-agent domains).
 */
export class LedgerService {
  constructor(
    private readonly query: JournalLedgerQueryPort,
    private readonly accounts: AccountsCrudPort,
    private readonly accountBalances: AccountBalancesService,
  ) {}

  // ── Obtener el libro mayor de una cuenta con saldo acumulado ──

  async getAccountLedger(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
  ): Promise<LedgerEntry[]> {
    const account = await this.accounts.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const lines = await this.query.findLinesByAccount(
      organizationId,
      accountId,
      { dateRange, periodId },
    );

    // Decimal running balance: arbitrary-precision cumulative sum of
    // (debit - credit) per line; serialize each row's monetary fields via
    // roundHalfUp(...).toFixed(2). sumDecimals is the canonical helper from
    // shared/domain/money.utils (EX-D3 dependency direction). Port shape
    // declares debit/credit as `unknown` (Decimal serialization is adapter
    // concern); String(...) coercion is safe — decimal.js Decimal accepts string.
    const deltas = lines.map((line) =>
      new Decimal(String(line.debit)).minus(
        new Decimal(String(line.credit)),
      ),
    );
    return lines.map((line, idx) => {
      const debit = new Decimal(String(line.debit));
      const credit = new Decimal(String(line.credit));
      const runningBalance = sumDecimals(deltas.slice(0, idx + 1));

      return {
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        description: line.description ?? line.journalEntry.description,
        debit: roundHalfUp(debit).toFixed(2),
        credit: roundHalfUp(credit).toFixed(2),
        balance: roundHalfUp(runningBalance).toFixed(2),
      };
    });
  }

  /**
   * Paginated libro-mayor: running-balance SEEDED FROM `openingBalanceDelta`
   * (sum of debit-credit of all prior-page rows) NOT from Decimal(0).
   * Correctness invariant: page-1 → opening=0 → byte-identical to legacy
   * getAccountLedger; page-N → opening=sum-prior → correct continuation.
   *
   * R-money TIER 1 discharged: accumulator stays in decimal.js Decimal
   * end-to-end (REQ-6/D6); string serialization only at DTO boundary via
   * roundHalfUp + toFixed(2). Returns LedgerPaginatedDto where openingBalance: string is
   * serialized via roundHalfUp+toFixed(2). Legacy getAccountLedger PRESERVED
   * untouched (REQ-7, dual-method additive transitional 5th evidence).
   *
   * §13 candidate: arch/§13/cumulative-state-paginated-dto-pattern 1st
   * evidence — paginated views requiring cumulative state get a dedicated
   * port DTO (LedgerPageResult) + DTO (LedgerPaginatedDto) without polluting
   * the shared PaginatedResult<T> VO.
   */
  async getAccountLedgerPaginated(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
    pagination?: PaginationOptions,
  ): Promise<LedgerPaginatedDto> {
    const account = await this.accounts.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const result = await this.query.findLinesByAccountPaginated(
      organizationId,
      accountId,
      { dateRange, periodId },
      pagination,
    );

    // Port declares openingBalanceDelta as `unknown` (decimal.js Decimal at
    // the adapter, opaque at the port edge). Coerce via String(...) — Decimal
    // accepts string input, preserving precision.
    const opening = new Decimal(String(result.openingBalanceDelta));

    // Running-balance accumulator SEEDED FROM opening (NOT Decimal(0)) —
    // novel vs legacy. Page 1 → opening=0 → equivalent to legacy behavior.
    let running = opening;
    const items: LedgerEntry[] = result.items.map((line) => {
      const debit = new Decimal(String(line.debit));
      const credit = new Decimal(String(line.credit));
      running = running.plus(debit).minus(credit);
      return {
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        description: line.description ?? line.journalEntry.description,
        debit: roundHalfUp(debit).toFixed(2),
        credit: roundHalfUp(credit).toFixed(2),
        balance: roundHalfUp(running).toFixed(2),
      };
    });

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      openingBalance: roundHalfUp(opening).toFixed(2),
    };
  }

  // ── Obtener balance de comprobación ──

  async getTrialBalance(
    organizationId: string,
    periodId: string,
  ): Promise<TrialBalanceRow[]> {
    // Principal: leer desde los registros de AccountBalance para el período
    const balances = await this.accountBalances.getBalances(
      organizationId,
      periodId,
    );

    if (balances.length > 0) {
      return balances.map((b) => {
        const totalDebit = new Decimal(String(b.debitTotal));
        const totalCredit = new Decimal(String(b.creditTotal));
        return {
          accountCode: b.account.code,
          accountName: b.account.name,
          accountType: b.account.type as AccountType,
          totalDebit: roundHalfUp(totalDebit).toFixed(2),
          totalCredit: roundHalfUp(totalCredit).toFixed(2),
          balance: roundHalfUp(totalDebit.minus(totalCredit)).toFixed(2),
        };
      });
    }

    // Fallback: agregar directamente desde las líneas de asiento POSTED
    const accounts = await this.accounts.findAll(organizationId);
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      const aggregation = await this.query.aggregateByAccount(
        organizationId,
        account.id,
        periodId,
      );

      const totalDebit = new Decimal(
        aggregation._sum.debit == null ? 0 : String(aggregation._sum.debit),
      );
      const totalCredit = new Decimal(
        aggregation._sum.credit == null ? 0 : String(aggregation._sum.credit),
      );

      rows.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        totalDebit: roundHalfUp(totalDebit).toFixed(2),
        totalCredit: roundHalfUp(totalCredit).toFixed(2),
        balance: roundHalfUp(totalDebit.minus(totalCredit)).toFixed(2),
      });
    }

    return rows;
  }
}
