import { NotFoundError } from "@/features/shared/errors";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import type { JournalLedgerQueryPort } from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  DateRangeFilter,
  LedgerEntry,
  TrialBalanceRow,
} from "@/modules/accounting/presentation/dto/ledger.types";
import {
  roundHalfUp,
  sumDecimals,
} from "@/modules/accounting/shared/domain/money.utils";
import { Prisma } from "@/generated/prisma/client";
import type { AccountType } from "@/generated/prisma/client";

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
 * running-balance accumulation and trial-balance totals use `Prisma.Decimal`
 * (`sumDecimals` + `.minus()` chain) from `shared/domain/money.utils`, with
 * `roundHalfUp(...).toFixed(2)` serializing monetary fields as `string` at
 * the DTO boundary. R-money textual deviation DISCHARGED.
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
    // concern); String(...) coercion is safe — Prisma.Decimal accepts string.
    const deltas = lines.map((line) =>
      new Prisma.Decimal(String(line.debit)).minus(
        new Prisma.Decimal(String(line.credit)),
      ),
    );
    return lines.map((line, idx) => {
      const debit = new Prisma.Decimal(String(line.debit));
      const credit = new Prisma.Decimal(String(line.credit));
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
        const totalDebit = new Prisma.Decimal(String(b.debitTotal));
        const totalCredit = new Prisma.Decimal(String(b.creditTotal));
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

      const totalDebit = new Prisma.Decimal(
        aggregation._sum.debit == null ? 0 : String(aggregation._sum.debit),
      );
      const totalCredit = new Prisma.Decimal(
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
