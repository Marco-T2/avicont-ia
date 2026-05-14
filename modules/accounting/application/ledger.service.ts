import { NotFoundError } from "@/features/shared/errors";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import type { JournalLedgerQueryPort } from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  DateRangeFilter,
  LedgerEntry,
  TrialBalanceRow,
} from "@/modules/accounting/presentation/dto/ledger.types";
import type { AccountType } from "@/generated/prisma/client";

/**
 * Application-layer libro-mayor use cases (POC #7 OLEADA 6 — C1).
 *
 * Migrated from legacy `features/accounting/ledger.service.ts` — the legacy
 * file had ZERO hex equivalent; this is a wholesale fold onto the hex. The
 * legacy file SURVIVES C1 (additive cutover) and is wholesale-deleted at C5.
 *
 * Port-driven: reaches journal-line data through `JournalLedgerQueryPort`
 * (not the Prisma repo directly), accounts through `AccountsCrudPort`, and
 * period balances through `AccountBalancesService` — parity with the legacy
 * ctor's three deps, swapping the direct `JournalRepository` for the query
 * port.
 *
 * ── DEV-1 / R-money — FLOAT money-math NAMED DEVIATION (design #2405) ──
 * `getAccountLedger` running-balance accumulation and `getTrialBalance`
 * debit/credit totals PRESERVE legacy float `Number()` coercion +
 * `runningBalance += debit - credit` arithmetic VERBATIM. This deliberately
 * does NOT converge to the canonical `shared/domain/money.utils.ts`
 * `sumDecimals`/`eq` (`Prisma.Decimal`) money invariant. Convergence is a
 * design-locked, deferred follow-up — ESCALATED per [[invariant_collision_
 * elevation]], NOT silently resolved. ZERO behavioral change vs legacy:
 * pass/fail outcomes and balance values are byte-identical pre/post-fold.
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

    // DEV-1 / R-money: float `Number()` running-balance — verbatim legacy.
    let runningBalance = 0;
    return lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      runningBalance += debit - credit;

      return {
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        description: line.description ?? line.journalEntry.description,
        debit,
        credit,
        balance: runningBalance,
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
        // DEV-1 / R-money: float `Number()` totals — verbatim legacy.
        const totalDebit = Number(b.debitTotal);
        const totalCredit = Number(b.creditTotal);
        return {
          accountCode: b.account.code,
          accountName: b.account.name,
          accountType: b.account.type as AccountType,
          totalDebit,
          totalCredit,
          balance: totalDebit - totalCredit,
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

      // DEV-1 / R-money: float `Number()` totals — verbatim legacy.
      const totalDebit = Number(aggregation._sum.debit ?? 0);
      const totalCredit = Number(aggregation._sum.credit ?? 0);

      rows.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
      });
    }

    return rows;
  }
}
